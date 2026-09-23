export const loadRazorpayScript = () => {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);

  if (!window.__razorpayScriptPromise) {
    window.__razorpayScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-razorpay-sdk="true"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.Razorpay));
        existingScript.addEventListener('error', () => reject(new Error('Razorpay SDK failed to load')));
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.setAttribute('data-razorpay-sdk', 'true');
      script.onload = () => window.Razorpay
        ? resolve(window.Razorpay)
        : reject(new Error('Razorpay SDK failed to initialize'));
      script.onerror = () => reject(new Error('Razorpay SDK failed to load'));
      document.body.appendChild(script);
    }).catch((error) => {
      window.__razorpayScriptPromise = null;
      throw error;
    });
  }

  return window.__razorpayScriptPromise;
};
