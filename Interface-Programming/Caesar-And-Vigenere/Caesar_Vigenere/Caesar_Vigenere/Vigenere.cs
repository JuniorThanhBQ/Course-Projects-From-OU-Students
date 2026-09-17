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
    public partial class Vigenere : Form
    {
        public class vigenere
        {
            public static string nguon = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            public static char[] P = nguon.ToCharArray();
            public static int[] taokhoa(string vao, int[] key)
            {
                char[] vanban = vao.ToCharArray();
                            int l = vanban.Length;
                            int[] plant = new int[l];
                            int j = 0;
                for (int i = 0; i<l; i++)
                {
                if (j > key.Length - 1) j = 0;
                plant[i] = key[j];
                j++;
                }
                return plant;
            }
                    public static int[] chuyenmakey(string s)
                    {
                        char[] vanban = s.ToCharArray();
                        int l = vanban.Length;
                        int[] tmp_local = new int[l];
                        int j = 0;
                        while (j < l)
                        {
                            for (int i = 0; i < P.Length; i++)
                            {
                                if (P[i] == vanban[j])
                                {
                                    tmp_local[j] = i;
                                }
                            }
                            j++;
                        }
                        return tmp_local;
                    }
                    public static string Mahoa(string s, int[] khoa)
                    {
                        char[] vanban = s.ToCharArray();
                        int l = vanban.Length;
                        int[] tmp_local = new int[l];
                        char[] temp = new char[l];
                        int maso;
                        for (int j = 0; j < l; j++)
                        {
                            for (int i = 0; i < P.Length; i++)
                            {
                                if (P[i] == vanban[j])
                                {
                                    tmp_local[j] = i;
                                    maso = (tmp_local[j] + khoa[j]) % P.Length;
                                    temp[j] = P[maso];
                                }
                            }
                        }
                        return new string(temp);
                    }
                public static string Giaima(string s, int[] khoa)
                {
                    char[] vanban = s.ToCharArray();
                    int l = vanban.Length;
                    int[] tmp_local = new int[l];
                    char[] temp = new char[l];
                    int maso;
                    for (int j = 0; j < l; j++)
                    {
                        for (int i = 0; i < P.Length; i++)
                        {
                            if (P[i] == vanban[j])
                            {
                                tmp_local[j] = i;
                                maso = ((tmp_local[j] + P.Length) - khoa[j]) % P.Length;
                                temp[j] = P[maso];
                            }
                        }
                    }
                    return new string(temp);
                }
            }
        public Vigenere()
        {
            InitializeComponent();
        }

        private void label1_Click(object sender, EventArgs e)
        {

        }

        private void button1_Click(object sender, EventArgs e)
        {
            if (textBox1.Text == "" || textBox3.Text == "")
                MessageBox.Show("Vui long dien day du thong tin!");
            else
            {
                textBox2.Text = vigenere.Mahoa(textBox1.Text.ToUpper(), vigenere.taokhoa(textBox1.Text.ToUpper(),vigenere.chuyenmakey(textBox3.Text)));
            }
        }

        private void button2_Click(object sender, EventArgs e)
        {
            if (textBox1.Text == "" || textBox3.Text == "")
                MessageBox.Show("Vui long dien day du thong tin!");
            else
            {
                textBox1.Text = vigenere.Giaima(textBox2.Text.ToUpper(), vigenere.taokhoa(textBox2.Text.ToUpper(), vigenere.chuyenmakey(textBox3.Text)));
            }
        }
    }
}
