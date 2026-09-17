using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace Caesar_Vigenere
{
    public partial class Caesar : Form
    {
        public class caesar
        {
            public static string nguon = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            public static char[] P = nguon.ToCharArray();
            public static string Mahoa(string s, int k)
            {
                int mahoa_local = 0;
                char[] vanban = s.ToCharArray();
                int l = vanban.Length;
                char[] tmp_text = new char[l];
                int[] tmp_local = new int[l];
                int j = 0;
                while (j < l)
                {
                    for (int i = 0; i < P.Length; i++)
                    {
                        if (P[i] == vanban[j])
                        {
                            tmp_local[j] = i;
                            mahoa_local = tmp_local[j] + k;
                            if (mahoa_local >= P.Length) mahoa_local = mahoa_local -
                            P.Length;
                            tmp_text[j] = P[mahoa_local];
                        }
                    }
                    j++;
                }
                return new string(tmp_text);
            }
            public static string GiaiMa(string s, int k)
            {
                int mahoa_local = 0;
                char[] vanban = s.ToCharArray();
                int l = vanban.Length;
                char[] tmp_text = new char[l];
                int[] tmp_local = new int[l];
                int j = 0;
                while (j < l)
                {
                    for (int i = 0; i < P.Length; i++)
                    {
                        if (P[i] == vanban[j])
                        {
                            tmp_local[j] = i;
                            mahoa_local = tmp_local[j] - k; if (mahoa_local < 0) mahoa_local = mahoa_local + P.Length;
                            tmp_text[j] = P[mahoa_local];
                        }
                    }
                    j++;
                }
                return new string(tmp_text);
            }
        }
    public Caesar()
        {
            InitializeComponent();
        }

        private void button1_Click(object sender, EventArgs e)
        {
            if (textBox1.Text == "" || textBox3.Text == "")
                MessageBox.Show("Vui long dien day du thong tin!");
            else if (!textBox3.Text.All(char.IsDigit))
                MessageBox.Show("Key khong hop le!");
            else
            {
                textBox2.Text = caesar.Mahoa(textBox1.Text.ToUpper(), int.Parse(textBox3.Text));
            }
        }

        private void button2_Click(object sender, EventArgs e)
        {
            if (textBox2.Text == "" || textBox3.Text == "")
                MessageBox.Show("Vui long dien day du thong tin!");
            else if (!textBox3.Text.All(char.IsDigit))
                MessageBox.Show("Key khong hop le!");
            else
            {
                textBox1.Text = caesar.GiaiMa(textBox2.Text.ToUpper(), int.Parse(textBox3.Text));
            }
        }
    }
}
