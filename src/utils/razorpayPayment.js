import { loadRazorpayScript } from './loadRazorpay';

export const initiateRazorpayPayment = async ({ order, owner, onFailure }) => {
  const Razorpay = await loadRazorpayScript();

  return new Promise((resolve, reject) => {
    const checkout = new Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency || 'INR',
      name: 'OneAttendance',
      description: 'Company subscription',
      order_id: order.order_id,
      prefill: {
        name: owner?.name || '',
        email: owner?.email || '',
        contact: owner?.phone || '',
      },
      notes: { order_id: order.order_id },
      theme: { color: '#2563eb' },
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => {
          onFailure?.();
          reject(new Error('Payment cancelled.'));
        },
      },
    });

    checkout.on('payment.failed', (response) => {
      onFailure?.();
      reject(new Error(response?.error?.description || 'Payment failed.'));
    });

    checkout.open();
  });
};
