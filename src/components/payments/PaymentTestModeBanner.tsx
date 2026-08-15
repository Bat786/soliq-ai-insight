const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full border-b border-bear/40 bg-bear/10 px-4 py-2 text-center text-xs text-bear">
        Production checkout is not configured yet. Complete payment go-live to accept real payments.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full border-b border-warn/40 bg-warn/10 px-4 py-2 text-center text-xs text-warn">
        Test mode — all payments in the preview are simulated. Use card 4242 4242 4242 4242.
      </div>
    );
  }
  return null;
}
