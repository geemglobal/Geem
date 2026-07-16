import { AuthenticateWithRedirectCallback } from "@clerk/react";

const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");

// After Google/Clerk finishes the OAuth handshake, land back on the account
// page. ShopAuthProvider notices the new Clerk session and exchanges it for
// a Geem shop session automatically.
export default function ShopGoogleCallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl={`${BASE_PATH}/shop/account`}
        signUpFallbackRedirectUrl={`${BASE_PATH}/shop/account`}
      />
      <p className="text-slate-500 text-sm">Signing you in with Google…</p>
    </div>
  );
}
