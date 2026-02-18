import React, { useEffect, useState } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { getStripeKey, hasStripeKey } from '@/config/stripe';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { IS_STORE_BUILD } from '@/config/build';

const stripePromise = hasStripeKey() ? loadStripe(getStripeKey()) : null;

interface PaymentFormProps {
  amount: number;
  coinPackage: {
    id: string;
    coins: number;
    price: number;
    label: string;
  };
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ amount, coinPackage, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + '/payment-success',
        },
        redirect: 'if_required',
      });

      if (error) {
        onError(error.message || 'Payment failed');
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess(paymentIntent.id);
      }
    } catch {
      onError('Payment processing failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <PaymentElement 
        options={{
          layout: 'tabs',
          wallets: {
            applePay: 'auto',
            googlePay: 'auto',
          },
        }}
      />
      <Button 
        type="submit" 
        disabled={!stripe || loading}
        className="w-full mt-4"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          `Buy ${coinPackage.label} for $${amount}`
        )}
      </Button>
    </form>
  );
};

interface StripePaymentElementProps {
  coinPackage: {
    id: string;
    coins: number;
    price: number;
    label: string;
  };
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
}

export const StripePaymentElement: React.FC<StripePaymentElementProps> = ({ 
  coinPackage, 
  onSuccess, 
  onError 
}) => {
  const user = useAuthStore((s) => s.user);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (IS_STORE_BUILD) {
      onError('Purchases are handled through the app store in native builds.');
      setLoading(false);
      return;
    }
    if (!user?.id) {
      onError('You must be logged in to purchase coins.');
      setLoading(false);
      return;
    }
    if (!stripePromise) {
      onError('Payments are not configured.');
      setLoading(false);
      return;
    }
    // Create payment intent on backend
    fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user.id
      },
      body: JSON.stringify({
        amount: Math.round(coinPackage.price * 100), // Convert to cents
        userId: user.id,
        coinPackage: {
          id: coinPackage.id,
          coins: coinPackage.coins,
          label: coinPackage.label,
        },
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setClientSecret(data.clientSecret);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error creating payment intent:', error);
        onError('Failed to initialize payment');
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coinPackage, user?.id]);

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#0099ff',
        colorBackground: '#ffffff',
        colorText: '#30313d',
        colorDanger: '#df1b41',
        fontFamily: 'Ideal Sans, system-ui, sans-serif',
        spacingUnit: '2px',
        borderRadius: '4px',
      },
    },
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="text-center p-4 text-red-600">
        Failed to initialize payment. Please try again.
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentForm 
        amount={coinPackage.price} 
        coinPackage={coinPackage}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
};
