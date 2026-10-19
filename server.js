import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 10000;
const TRANZUPI_API_KEY = process.env.TRANZUPI_API_KEY; // user_token value from TranzUPI dashboard
const FRONTEND_URL = process.env.FRONTEND_URL || `http://localhost:${PORT}`;
const BASE_URL = 'https://www.tranzupi.com';

app.use(express.static(__dirname));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', port: PORT });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/success.html', (_req, res) => {
  res.sendFile(path.join(__dirname, 'success.html'));
});

app.post('/create-payment-link', async (req, res) => {
  try {
    const { amount, customer_name, customer_email, customer_mobile, product_id, user_id } = req.body || {};

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ msg: 'Valid amount is required.' });
    }

    if (!TRANZUPI_API_KEY) {
      const demoOrderId = `demo_${Date.now()}`;
      const demoUrl = `${FRONTEND_URL}/success.html?demo=1`;
      return res.json({
        payment_link: demoUrl,
        order_id: demoOrderId,
        demo: true,
        message: 'Demo mode: set TRANZUPI_API_KEY in Render environment.'
      });
    }

    const order_id = 'ord_' + Date.now();
    const params = new URLSearchParams({
      user_token: TRANZUPI_API_KEY,
      amount: String(amount),
      order_id,
      customer_name: customer_name || 'Customer',
      customer_email: customer_email || '',
      customer_mobile: customer_mobile || '',
      redirect_url: `${FRONTEND_URL}/success.html`,
      note: `Purchase of product: ${product_id || 'pdf'}`
    });

    const response = await axios.post(`${BASE_URL}/api/create-order`, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const paymentUrl = response.data?.payment_url;
    if (!paymentUrl) {
      return res.status(500).json({ msg: 'Payment link not generated', raw: response.data });
    }

    return res.json({
      payment_link: paymentUrl,
      order_id,
      product_id: product_id || null,
      user_id: user_id || null
    });
  } catch (error) {
    console.error('Create order error:', error.response?.data || error.message);
    return res.status(500).json({ msg: 'Payment initiation failed' });
  }
});

app.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    console.log('Webhook received:', payload);

    const isSuccess = payload.status === 'SUCCESS' || payload.txnStatus === 'SUCCESS';

    if (isSuccess) {
      const orderId = payload.order_id || payload.data?.order_id;
      console.log(`✅ Payment successful for order: ${orderId}`);
      // Grant PDF access here after checking order_id in your DB.
    }

    res.status(200).send('OK');
  } catch (e) {
    console.error('Webhook error:', e);
    res.status(500).send('Error');
  }
});

app.get('/', (_, res) => res.send('PDF Store backend is running'));

app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));
