import { useCallback, useState } from "react";

import { StripeEmbeddedCheckout } from "@/components/payments/StripeEmbeddedCheckout";

interface CheckoutOptions {
  priceId: string;
  returnUrl?: string;
}

export function useStripeCheckout() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<CheckoutOptions | null>(null);

  const openCheckout = useCallback((opts: CheckoutOptions) => {
    setOptions(opts);
    setIsOpen(true);
  }, []);

  const closeCheckout = useCallback(() => {
    setIsOpen(false);
    setOptions(null);
  }, []);

  // Render the element directly — returning a component factory would remount
  // EmbeddedCheckoutProvider and throw "cannot change the client secret".
  const checkoutElement = isOpen && options ? <StripeEmbeddedCheckout {...options} /> : null;

  return { openCheckout, closeCheckout, isOpen, checkoutElement };
}
