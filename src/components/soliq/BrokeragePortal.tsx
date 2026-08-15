import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

/**
 * SnapTrade Connection Portal — official `snaptrade-react` modal.
 * Loaded client-side only (the SDK touches window / antd style injection).
 */
const SnapTradeReact = lazy(async () => {
  const mod = await import("snaptrade-react");
  return { default: mod.SnapTradeReact };
});

export type PortalErrorData = { errorCode?: string; statusCode?: string; detail?: string };

type Props = {
  loginLink: string | null;
  isOpen: boolean;
  close: () => void;
  onSuccess: (authorizationId: string) => void;
  onError: (data: PortalErrorData) => void;
  onExit?: () => void;
};

export function BrokeragePortal({ loginLink, isOpen, close, onSuccess, onError, onExit }: Props) {
  if (!loginLink) return null;
  return (
    <ClientOnly>
      <Suspense fallback={null}>
        <SnapTradeReact
          loginLink={loginLink}
          isOpen={isOpen}
          close={close}
          onSuccess={onSuccess}
          onError={(d) => onError(d as PortalErrorData)}
          {...(onExit ? { onExit } : {})}
          contentLabel="Connect your brokerage"
          style={{ overlay: { backgroundColor: "rgba(3, 7, 18, 0.78)", zIndex: 60 } }}
        />
      </Suspense>
    </ClientOnly>
  );
}
