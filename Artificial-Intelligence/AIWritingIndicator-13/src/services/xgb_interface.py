import os
import json
import re
import unicodedata
import gc
import string
import pandas as pd
import numpy as np
import torch
import xgboost as xgb
from tqdm import tqdm
from collections import Counter
from huggingface_hub import hf_hub_download
from scipy.stats import entropy
from sklearn.feature_extraction.text import CountVectorizer
from transformers import AutoTokenizer, AutoModelForCausalLM, AutoModel

from underthesea import sent_tokenize, word_tokenize, pos_tag
import joblib

try:
    from your_custom_ner import ner
except ImportError:
    def ner(text): return []

def load_const_seeds(filepath="src/models/configs/const_seeds.json"):
    if not os.path.exists(filepath):
        return {'causal': [], 'contrast': [], 'additive': [], 'temporal': []}
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"File '{filepath}' không chuẩn định dạng JSON. Chi tiết lỗi: {e}")
    except Exception as e:
        raise RuntimeError(f"Lỗi không xác định khi đọc file '{filepath}': {e}")

CONST_SEED = load_const_seeds()

class PipelineStep:
    def execute(self, df, text_col, label_col=None):
        raise NotImplementedError

class CausalSurprisalStep(PipelineStep):
    def __init__(self, model_name="NlpHUST/gpt2-vietnamese"):
        self.model_name = model_name
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.dtype = torch.float16 if torch.cuda.is_available() else torch.float32

    def safe(self, v):
        return 0.0 if np.isnan(v) or np.isinf(v) else float(v)

    def _aggregate_to_word_level(self, surprisal_array, word_ids):
        if len(surprisal_array) != len(word_ids):
            return surprisal_array
        word_surprisals = {}
        for surp, w_id in zip(surprisal_array, word_ids):
            if w_id is not None:
                word_surprisals[w_id] = word_surprisals.get(w_id, 0) + surp
        if not word_surprisals or len(surprisal_array) == 0 or len(word_ids) == 0:
            return np.array([])
        return np.array([word_surprisals[k] for k in sorted(word_surprisals.keys())])

    def execute(self, df, text_col, label_col=None):
        feature_names = ['mean', 'var', 'tail', 'd2_entropy']
        metrics = {k: np.zeros(len(df)) for k in feature_names}
        try:
            tokenizer = AutoTokenizer.from_pretrained(self.model_name, use_fast=True)
            model = AutoModelForCausalLM.from_pretrained(self.model_name, torch_dtype=self.dtype)
            model.to(self.device)
            model.eval()
        except Exception as e:
            return df
        loss_fct = torch.nn.CrossEntropyLoss(reduction='none')
        with torch.no_grad():
            for idx, text in enumerate(df[text_col]):
                try:
                    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=1024).to(self.device)
                    input_ids = inputs["input_ids"]
                    if input_ids.size(1) < 4:
                        continue
                    outputs = model(input_ids)
                    shift_logits = outputs.logits[..., :-1, :].contiguous()
                    shift_labels = input_ids[..., 1:].contiguous()
                    surprisal_tensor = loss_fct(shift_logits.view(-1, shift_logits.size(-1)), shift_labels.view(-1))
                    S_raw = surprisal_tensor.cpu().numpy().astype(np.float64)
                    word_ids = inputs.word_ids(batch_index=0)[1:]
                    S = self._aggregate_to_word_level(S_raw, word_ids)
                    if len(S) < 5 or np.std(S) < 1e-6:
                        continue
                    metrics['mean'][idx] = np.mean(S)
                    metrics['var'][idx] = np.var(S)
                    metrics['tail'][idx] = np.percentile(S, 95)
                    d1 = np.diff(S)
                    d2 = np.diff(d1)
                    if len(d2) > 10:
                        hist, _ = np.histogram(d2, bins=10, density=True)
                        metrics['d2_entropy'][idx] = entropy(hist + 1e-9)
                except Exception as e:
                    pass
        del model, tokenizer
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        for k in feature_names:
            df[f'gpt_{k}'] = metrics[k]
        return df

class AdvancedLogicFeatureExtractor(PipelineStep):
    def __init__(self,
                 seeds=None,
                 pronoun_list=None,
                 verb_noise_list=None,
                 ngram_range=(2, 6),
                 min_df=5,
                 max_df=0.7,
                 production_markers_path="src/models/configs/logic_markers_prod.json"):
        self.groups = ['causal', 'contrast', 'additive', 'temporal']
        if not seeds:
            raise ValueError("Thiếu file seed")
        self.seeds = seeds
        self.pronoun_list = pronoun_list or {
            'tôi', 'ta', 'chúng ta', 'chúng tôi', 'mình', 'bạn', 'các bạn', 'họ', 'bọn họ', 'anh', 'chị', 'em', 'ông', 'bà', 'chú', 'bác', 'nó', 'hắn', 'tao', 'mày', 'tớ', 'tụi', 'tụi nó', 'bọn', 'bọn nó', 'anh ấy', 'chị ấy', 'cô ấy', 'ông ấy', 'bà ấy', 'anh ta', 'chị ta', 'họ ta', 'cô', 'dì', 'dượng', 'cậu', 'mợ', 'thầy', 'con', 'cháu', 'người ta', 'ai đó', 'mọi người', 'chúng nó', 'tụi mình', 'bọn mình'
        }
        self.verb_noise_list = verb_noise_list or {
            'nghĩ', 'thấy', 'cho rằng', 'rằng', 'là', 'sẽ', 'đã', 'đang'
        }
        self.ngram_range = ngram_range
        self.min_df = min_df
        self.max_df = max_df
        self.dynamic_markers = {g: set() for g in self.groups}
        self.dynamic_blacklist = set()
        self.regex_patterns = {}
        self.production_markers_path = production_markers_path
        if self.production_markers_path:
            self._load_production_markers()
            self._compile_regex_from_seeds()

    def _is_noise(self, ngram):
        for p in self.pronoun_list:
            for v in self.verb_noise_list:
                if f"{p} {v}" in ngram:
                    return True
        if len(ngram.split()) > 6:
            return True
        return False

    def _build_dynamic_markers_in_memory(self, df, text_col):
        starters = []
        for text in df[text_col].dropna():
            sentences = sent_tokenize(str(text))
            for sent in sentences:
                words = sent.split()
                if len(words) >= 2:
                    starters.append(sent.lower())
        if not starters:
            self._compile_regex_from_seeds()
            return
        vectorizer = CountVectorizer(ngram_range=self.ngram_range, min_df=self.min_df, max_df=self.max_df)
        X = vectorizer.fit_transform(starters)
        freqs = zip(vectorizer.get_feature_names_out(), X.sum(axis=0).tolist()[0])
        sorted_ngrams = sorted(freqs, key=lambda x: x[1], reverse=True)
        for ngram, freq in sorted_ngrams:
            if self._is_noise(ngram):
                self.dynamic_blacklist.add(ngram)
                continue
            for g, seed_words in self.seeds.items():
                if any(s in ngram for s in seed_words):
                    self.dynamic_markers[g].add(ngram)
                    break
        self._compile_regex_from_seeds()

    def _compile_regex_from_seeds(self):
        for g in self.groups:
            manual_seeds = set(self.seeds.get(g, []))
            dynamic_found = self.dynamic_markers[g]
            all_markers = manual_seeds.union(dynamic_found)
            if not all_markers:
                continue
            sorted_markers = sorted(list(all_markers), key=len, reverse=True)
            pattern = r'(?<!\w)(' + '|'.join(map(re.escape, sorted_markers)) + r')(?!\w)'
            self.regex_patterns[g] = re.compile(pattern, re.IGNORECASE | re.UNICODE)

    def _extract_logic_metrics(self, text):
        sentences = sent_tokenize(str(text))
        num_sentences = len(sentences)
        res = {f'{g}_count': 0 for g in self.groups}
        res['transition_count'] = 0
        if num_sentences == 0:
            return pd.Series(res)
        for i, sent in enumerate(sentences):
            sent_lower = sent.lower()
            is_transition = False
            for g in self.groups:
                if g not in self.regex_patterns:
                    continue
                pattern = self.regex_patterns[g]
                matches = list(pattern.finditer(sent_lower))
                count = len(matches)
                if count > 0:
                    res[f'{g}_count'] += count
                    if not is_transition and matches[0].start() <= 20:
                        is_transition = True
            if is_transition:
                res['transition_count'] += 1
        res['num_sentences'] = num_sentences
        return pd.Series(res)

    def export_markers_for_production(self, expected_logic_val, filepath="src/models/configs/logic_markers_prod.json"):
        export_data = {
            "markers": {k: list(v) for k, v in self.dynamic_markers.items()},
            "expected_logic": float(expected_logic_val)
        }
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=4)

    def _load_production_markers(self):
        try:
            if not os.path.exists(self.production_markers_path):
                self.saved_expected_logic = 0.0
                return
            with open(self.production_markers_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if "markers" in data:
                self.dynamic_markers = {k: set(v) for k, v in data["markers"].items()}
                self.saved_expected_logic = data.get("expected_logic", 0.0)
            else:
                self.dynamic_markers = {k: set(v) for k, v in data.items()}
                self.saved_expected_logic = 0.0
        except Exception as e:
            self.saved_expected_logic = 0.0

    def execute(self, df, text_col, label_col=None):
        if not self.production_markers_path:
            self._build_dynamic_markers_in_memory(df, text_col)
        if 'seg_length' not in df.columns:
            df['seg_length'] = df[text_col].apply(lambda x: len(str(x).split()))
        try:
            tqdm.pandas(desc="[Logic] Áp dụng Regex tính Metrics")
            metrics_df = df[text_col].progress_apply(self._extract_logic_metrics)
        except (AttributeError, NameError):
            metrics_df = df[text_col].apply(self._extract_logic_metrics)
        df = pd.concat([df, metrics_df], axis=1)
        for g in self.groups:
            df[f'{g}_density'] = df[f'{g}_count'] / (df['seg_length'] + 1e-6)
        df['logic_transition_points'] = df['transition_count'] / (df['num_sentences'] + 1e-6)
        densities = df[[f'{g}_density' for g in self.groups]]
        df['logic_mismatch_score'] = densities.std(axis=1)
        df['logic_density'] = sum(df[f'{g}_count'] for g in self.groups) / (df['seg_length'] + 1e-6)
        if self.production_markers_path and hasattr(self, 'saved_expected_logic'):
            expected_logic = getattr(self, 'saved_expected_logic', 0.0)
        else:
            expected_logic = float(df['logic_density'].mean())
            self.export_markers_for_production(expected_logic, "src/models/configs/logic_markers_prod.json")
        df['logic_deviation'] = abs(df['logic_density'] - expected_logic)
        df = df.drop(columns=['logic_transition_points','num_sentences', 'transition_count'] + [f'{g}_count' for g in self.groups])
        return df

class SyntacticAndStructuralStep(PipelineStep):
    def __init__(self):
        raw_pronouns = [
            "tôi", "tao", "tớ", "mình", "ta", "chúng tôi", "chúng ta", "tụi tôi", "bọn tôi", "tụi mình",
            "bạn", "cậu", "mày", "mi", "các bạn", "tụi bây", "bọn mày", "nó", "hắn", "y", "người ta",
            "họ", "chúng nó", "tụi nó", "bọn họ", "ai", "gì", "nào", "bao nhiêu", "bao giờ"
        ]
        self.pronoun_set = set([p.replace(" ", "_") for p in raw_pronouns])

    def _compute_recombined_features(self, text):
        paragraphs = [p for p in text.split('\n') if p.strip()]
        sentences = []
        for p in paragraphs: sentences.extend(sent_tokenize(p))
        sent_words = [word_tokenize(s) for s in sentences]
        sent_lengths = [len(words) for words in sent_words]
        total_words = sum(sent_lengths)
        total_words_safe = max(1, total_words)
        sent_len_mean = float(np.mean(sent_lengths)) if sent_lengths else 0.0
        sent_len_var = float(np.var(sent_lengths)) if sent_lengths else 0.0
        sent_len_cv = sent_len_var / (sent_len_mean + 1e-6)
        comma_counts = [s.count(',') for s in sentences]
        punct_counts = [sum(1 for char in s if char in string.punctuation) for s in sentences]
        comma_density = sum(comma_counts) / total_words_safe
        punctuation_density = sum(punct_counts) / total_words_safe
        all_words_lower = [w.lower() for words in sent_words for w in words]
        total_pronouns = sum(1 for w in all_words_lower if w in self.pronoun_set)
        pronoun_ratio = total_pronouns / total_words_safe
        return (sent_len_cv, comma_density, punctuation_density, pronoun_ratio)

    def execute(self, df, text_col, label_col=None):
        res = df[text_col].apply(self._compute_recombined_features)
        cols = ['sent_len_cv', 'comma_density', 'punctuation_density', 'pronoun_ratio']
        df[cols] = pd.DataFrame(res.tolist(), index=df.index)
        return df

class PhoBERTFeaturePipeline(PipelineStep):
    def __init__(self, model_name="vinai/phobert-base-v2", batch_size=16):
        self.model_name = model_name
        self.batch_size = batch_size
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.max_length = 256
        self.stride = 128

    def _compute_cpu_features(self, text):
        if not isinstance(text, str) or not text.strip():
            return (0.0, 0.0, [])
        try:
            sentences = sent_tokenize(text)
            pos_var = 0.0
            try:
                tags = pos_tag(text)
                if tags:
                    pos_counts = Counter(tag for _, tag in tags)
                    total_tags = sum(pos_counts.values())
                    probs = [c / total_tags for c in pos_counts.values()]
                    pos_var = float(np.var(probs))
            except Exception:
                pass
            entity_grid = 0.0
            try:
                if len(sentences) > 1:
                    sentence_entities = []
                    for s in sentences:
                        entities = {w for w, _, _, tg in ner(s) if tg != 'O'}
                        entities.update(w for w, tg in pos_tag(s) if str(tg).startswith('N'))
                        sentence_entities.append(entities)
                    overlaps = [len(set1 & set2) / max(1, len(set1 | set2))
                                for set1, set2 in zip(sentence_entities[:-1], sentence_entities[1:])]
                    if overlaps:
                        entity_grid = float(np.mean(overlaps))
            except Exception:
                pass
            return (pos_var, entity_grid, sentences)
        except Exception:
            return (0.0, 0.0, [])

    def _mean_pooling(self, model_output, attention_mask):
        token_embeddings = model_output[0]
        input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
        return torch.sum(token_embeddings * input_mask_expanded, 1) / torch.clamp(input_mask_expanded.sum(1), min=1e-9)

    def _get_sentence_embeddings(self, sentences, tokenizer, model):
        if not sentences: return np.array([])
        chunked_inputs = []
        sentence_to_chunk_map = []
        current_chunk_idx = 0
        tokenized_sents = tokenizer(sentences, add_special_tokens=False, return_attention_mask=False)['input_ids']
        for tokens in tokenized_sents:
            if len(tokens) <= self.max_length - 2:
                chunked_inputs.append([tokenizer.cls_token_id] + tokens + [tokenizer.sep_token_id])
                sentence_to_chunk_map.append([current_chunk_idx])
                current_chunk_idx += 1
            else:
                sent_chunks_idx = []
                for i in range(0, len(tokens), self.max_length - self.stride - 2):
                    window_tokens = tokens[i : i + (self.max_length - 2)]
                    chunked_inputs.append([tokenizer.cls_token_id] + window_tokens + [tokenizer.sep_token_id])
                    sent_chunks_idx.append(current_chunk_idx)
                    current_chunk_idx += 1
                sentence_to_chunk_map.append(sent_chunks_idx)
        chunk_embeddings = []
        model.eval()
        pad_id = tokenizer.pad_token_id
        with torch.no_grad():
            for i in range(0, len(chunked_inputs), self.batch_size):
                batch_tokens = chunked_inputs[i : i + self.batch_size]
                max_len = max(len(t) for t in batch_tokens)
                input_ids = torch.tensor(
                    [t + [pad_id] * (max_len - len(t)) for t in batch_tokens],
                    dtype=torch.long, device=self.device
                )
                attention_mask = (input_ids != pad_id).float()
                outputs = model(input_ids=input_ids, attention_mask=attention_mask)
                embeddings = self._mean_pooling(outputs, attention_mask)
                embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)
                chunk_embeddings.append(embeddings.cpu().numpy())
        chunk_embeddings = np.concatenate(chunk_embeddings, axis=0)
        all_sentence_embeddings = np.empty((len(sentence_to_chunk_map), chunk_embeddings.shape[1]), dtype=np.float32)
        for idx, chunk_indices in enumerate(sentence_to_chunk_map):
            sent_embeds = chunk_embeddings[chunk_indices]
            final_sent_embed = np.mean(sent_embeds, axis=0)
            norm = np.linalg.norm(final_sent_embed)
            if norm > 0:
                final_sent_embed = final_sent_embed / norm
            all_sentence_embeddings[idx] = final_sent_embed
        return all_sentence_embeddings

    def execute(self, df, text_col, label_col=None, **kwargs):
        cpu_results = [self._compute_cpu_features(text) for text in df[text_col]]
        df['pos_distribution_variance'] = [x[0] for x in cpu_results]
        df['entity_grid_score'] = [x[1] for x in cpu_results]
        all_sentences = []
        text_sent_indices = []
        current_idx = 0
        for res in cpu_results:
            sents = res[2]
            n_sents = len(sents)
            text_sent_indices.append((current_idx, current_idx + n_sents))
            all_sentences.extend(sents)
            current_idx += n_sents
        if not all_sentences:
            for col in ['sentence_embedding_coherence', 'topic_drift_score', 'semantic_drift_score', 'embedding_distribution_entropy']:
                df[col] = 0.0
            return df
        tokenizer = None
        model = None
        try:
            tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            model = AutoModel.from_pretrained(self.model_name).to(self.device)
            all_embeddings = self._get_sentence_embeddings(all_sentences, tokenizer, model)
        except Exception as e:
            for col in ['sentence_embedding_coherence', 'topic_drift_score', 'semantic_drift_score', 'embedding_distribution_entropy']:
                df[col] = 0.0
            return df
        finally:
            if model is not None:
                del model
            if tokenizer is not None:
                del tokenizer
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        n_docs = len(text_sent_indices)
        coherences = np.zeros(n_docs, dtype=np.float32)
        topic_drifts = np.zeros(n_docs, dtype=np.float32)
        sem_drifts = np.zeros(n_docs, dtype=np.float32)
        entropies = np.zeros(n_docs, dtype=np.float32)
        for doc_idx, (start, end) in enumerate(text_sent_indices):
            n = end - start
            if n < 2:
                continue
            doc_embeds = all_embeddings[start:end]
            sims = np.sum(doc_embeds[:-1] * doc_embeds[1:], axis=1)
            sims = np.clip(sims, -1.0, 1.0)
            coherences[doc_idx] = float(np.mean(sims))
            topic_drifts[doc_idx] = float(np.var(sims))
            sem_drift = 1.0 - np.clip(np.dot(doc_embeds[0], doc_embeds[-1]), -1.0, 1.0)
            sem_drifts[doc_idx] = float(sem_drift)
            try:
                centered_embeds = doc_embeds - np.mean(doc_embeds, axis=0)
                _, S, _ = np.linalg.svd(centered_embeds, full_matrices=False)
                explained_variance = (S ** 2) / (n - 1)
                total_var = np.sum(explained_variance)
                if total_var > 0:
                    probs = explained_variance / total_var
                    probs = probs[probs > 0]
                    entropies[doc_idx] = float(-np.sum(probs * np.log2(probs)))
            except np.linalg.LinAlgError:
                pass
        df['sentence_embedding_coherence'] = coherences
        df['topic_drift_score'] = topic_drifts
        df['semantic_drift_score'] = sem_drifts
        df['embedding_distribution_entropy'] = entropies
        return df

class InteractionFeatureStep(PipelineStep):
    def execute(self, df: pd.DataFrame, text_col: str, label_col: str) -> pd.DataFrame:
        out_df = df.copy()
        out_df['gpt_var_x_semantic_drift'] = out_df.get('gpt_var', 0) * out_df.get('semantic_drift_score', 0)
        out_df['gpt_mean_x_embedding_coherence'] = out_df.get('gpt_mean', 0) * out_df.get('sentence_embedding_coherence', 0)
        out_df['gpt_tail_x_semantic_drift'] = out_df.get('gpt_tail', 0) * out_df.get('semantic_drift_score', 0)
        out_df['comma_density_x_gpt_var'] = out_df.get('comma_density', 0) * out_df.get('gpt_var', 0)
        out_df['logic_deviation_x_embedding_coherence'] = out_df.get('logic_deviation', 0) * out_df.get('sentence_embedding_coherence', 0)
        out_df['transition_density'] = (out_df.get('causal_density', 0) +
                                        out_df.get('contrast_density', 0) +
                                        out_df.get('additive_density', 0) +
                                        out_df.get('temporal_density', 0))
        out_df['embedding_coherence_x_entropy'] = out_df.get('sentence_embedding_coherence', 0) * out_df.get('embedding_distribution_entropy', 0)
        out_df['semantic_drift_x_entropy'] = out_df.get('semantic_drift_score', 0) * out_df.get('embedding_distribution_entropy', 0)
        out_df['semantic_drift_ratio'] = out_df.get('semantic_drift_score', 0) / (out_df.get('gpt_var', 0) + 1e-5)
        out_df['combo_gpt_sent_punct'] = out_df.get('gpt_var', 0) * out_df.get('sent_len_cv', 0) * out_df.get('punctuation_density', 0)
        return out_df

class TextAnalyzerUI:
    def __init__(self, const_seeds):
        self.logic_extractor = AdvancedLogicFeatureExtractor(
            seeds=const_seeds,
            production_markers_path="src/models/configs/logic_markers_prod.json"
        )
        self.syntax_extractor = SyntacticAndStructuralStep()
        self.semantic_extractor = PhoBERTFeaturePipeline()
        self.causal_extractor = CausalSurprisalStep(
            model_name="NlpHUST/gpt2-vietnamese"
        )
        self.interaction_extractor = InteractionFeatureStep()
        self.disallowed_pattern = re.compile(
            r'[^a-zA-Z0-9\s\.,\?!\-\(\)\'"“”‘’/_%àáãạảăắằẳẵặâấầẩẫậèéẹẻẽêềếểễệđìíĩỉịòóõọỏôốồổỗộơớờởỡợùúũụủưứừửữựỳýỹỷỵÀÁÃẠẢĂẮẰẲẴẶÂẤẦẨẪẬÈÉẸẺẼÊỀẾỂỄỆĐÌÍĨỈỊÒÓÕỌỎÔỐỒỔỖỘƠỚỜỞỠỢÙÚŨỤỦƯỨỪỬỮỰỲÝỸỶỴ]+'
        )

    def _validate_and_clean(self, text):
        if not isinstance(text, str):
            return False, "Dữ liệu đầu vào phải là văn bản (String)."
        text = unicodedata.normalize('NFC', text.strip())
        text = re.sub(r'[\r\n\t]+', ' ', text)
        text = re.sub(r'(http[s]?://|www\.|<.*?>|\S+@\S+|#\w+|@\w+)', '', text)
        text = text.replace(":", "")
        text = re.sub(self.disallowed_pattern, ' ', text)
        text = re.sub(r'\s{2,}', ' ', text)
        text = text.strip()
        if not text:
            return False, "Văn bản trống hoặc chỉ chứa ký tự rác."
        upper_chars = sum(1 for c in text if c.isupper())
        if len(text) > 0 and (upper_chars / len(text)) > 0.2:
            text = text.lower()
        if text[0].isalpha() and not text[0].isupper():
            text = text[0].upper() + text[1:]
        if not text.endswith('.'):
            last_period_index = text.rfind('.')
            if last_period_index == -1:
                return False, f"Văn bản phải chứa ít nhất một dấu chấm câu kết thúc."
            text = text[:last_period_index + 1]
        if not text[0].isalpha():
            return False, f"Văn bản phải bắt đầu bằng chữ cái (Hiện tại: '{text[0]}')."
        if text.count('"') % 2 != 0:
            return False, "Lỗi cú pháp: Số lượng dấu ngoặc kép không đồng đều."
        words = text.split()
        word_count = len(words)
        if word_count < 200 or word_count > 2000:
            return False, f"Độ dài không hợp lệ ({word_count} từ). Yêu cầu từ 200 đến 2000 từ."
        vietnamese_vowels = re.findall(r'[àáãạảăắằẳẵặâấầẩẫậèéẹẻẽêềếểễệđìíĩỉịòóõọỏôốồổỗộơớờởỡợùúũụủưứừửữựỳýỹỷỵ]', text.lower())
        if (len(vietnamese_vowels) / word_count) < 0.2:
            return False, "Tỷ lệ nguyên âm tiếng Việt quá thấp (Nghi ngờ Spam)."
        return True, text

    def process_request(self, user_input_text):
        is_valid, result = self._validate_and_clean(user_input_text)
        if not is_valid:
            return {
                "status": "error",
                "message": result,
                "features": None
            }
        try:
            df = pd.DataFrame([{"text": result}])
            df = self.logic_extractor.execute(df, text_col='text')
            df = self.syntax_extractor.execute(df, text_col='text')
            df = self.semantic_extractor.execute(df, text_col='text')
            df = self.causal_extractor.execute(df, text_col='text')
            df = self.interaction_extractor.execute(df, text_col='text', label_col=None)
            df = df.drop(columns=['text', 'seg_length'], errors='ignore')
            features_dict = df.iloc[0].to_dict()
            return {
                "status": "success",
                "message": "Trích xuất đặc trưng thành công.",
                "features": features_dict
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Lỗi trích xuất: {str(e)}",
                "features": None
            }

    def execute(self, df, text_col='text'):
        validation_results = df[text_col].apply(self._validate_and_clean)
        df['is_valid'] = validation_results.apply(lambda x: x[0])
        df['processed_text'] = validation_results.apply(lambda x: x[1])
        df['error_msg'] = validation_results.apply(lambda x: x[1] if not x[0] else None)
        valid_df = df[df['is_valid']].copy()
        invalid_df = df[~df['is_valid']].copy()
        if not valid_df.empty:
            valid_df = self.logic_extractor.execute(valid_df, text_col='processed_text')
            valid_df = self.syntax_extractor.execute(valid_df, text_col='processed_text')
            valid_df = self.semantic_extractor.execute(valid_df, text_col='processed_text')
            valid_df = self.causal_extractor.execute(valid_df, text_col='processed_text')
            valid_df = self.interaction_extractor.execute(valid_df, text_col='processed_text', label_col=None)
        result_df = pd.concat([valid_df, invalid_df], ignore_index=False)
        result_df = result_df.sort_index()
        return result_df

class BatchEvaluator:
    def __init__(self, text_analyzer, trained_model, model_config):
        self.analyzer = text_analyzer
        self.model = trained_model
        self.feature_names = model_config.get("features", [])
        self.threshold = model_config.get("optimal_threshold_ood")
        if not self.feature_names:
            print("CẢNH BÁO: Không tìm thấy danh sách 'features' trong config!")

    def evaluate_dataframe(self, df, text_col='text', label_col='label'):
        extracted_df = self.analyzer.execute(df.copy(), text_col=text_col)
        missing_cols = [col for col in self.feature_names if col not in extracted_df.columns]
        if missing_cols:
             print(f"LỖI NGHIÊM TRỌNG: Dữ liệu trích xuất thiếu các cột: {missing_cols}")
             return None
        valid_df = extracted_df[self.feature_names].fillna(0.0)
        if hasattr(self.model, "predict_proba"):
            raw_probs = self.model.predict_proba(valid_df)[:, 1]
            scaled_probs = np.where(
                raw_probs < self.threshold,
                (raw_probs / self.threshold) * 0.5,
                0.5 + ((raw_probs - self.threshold) / (1.0 - self.threshold)) * 0.5
            )
            probabilities = scaled_probs
            predictions = (scaled_probs >= 0.5).astype(int)
        else:
            probabilities = [None] * len(valid_df)
            predictions = self.model.predict(valid_df)
        extracted_df['predicted_label'] = predictions
        extracted_df['probability'] = probabilities
        if label_col in extracted_df.columns:
            extracted_df['is_correct'] = extracted_df['predicted_label'] == extracted_df[label_col]
        total_samples = len(df)
        valid_samples = len(extracted_df)
        if label_col in extracted_df.columns and valid_samples > 0:
            correct_predictions = extracted_df['is_correct'].sum()
            incorrect_predictions = valid_samples - correct_predictions
            accuracy = (correct_predictions / valid_samples * 100)
        return extracted_df

class XGBInterface:
    def __init__(self, hf_repo_id="JuniorThanh/xgboost_final_streamlit"):
        self.const_seeds = load_const_seeds("src/models/configs/const_seeds.json")
        self.analyzer = TextAnalyzerUI(self.const_seeds)
        model_config_path = hf_hub_download(repo_id=hf_repo_id, filename="model_config.json")
        with open(model_config_path, 'r') as f:
            self.model_config = json.load(f)
        model_path = hf_hub_download(repo_id=hf_repo_id, filename="xgb_robust_final.joblib")
        self.model = joblib.load(model_path)
        self.evaluator = BatchEvaluator(self.analyzer, self.model, self.model_config)

    def predict(self, text: str):
        df = pd.DataFrame([{"text": text}])
        result_df = self.evaluator.evaluate_dataframe(df, text_col='text')
        if result_df is None or result_df.empty:
            return {"status": "error", "message": "Prediction failed"}
        pred = result_df.iloc[0]['predicted_label']
        prob = result_df.iloc[0]['probability']
        return {"prediction": int(pred), "probability": float(prob)}