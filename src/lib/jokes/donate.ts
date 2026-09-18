export const PAYPAL_DONATE_EMAIL = "kent.borgos22@gmail.com";
export const PAYPAL_DONATE_ACTION = "https://www.paypal.com/cgi-bin/webscr";
export const PAYPAL_DONATE_ITEM = "Laugh4.LoL — We Could All Use A Little Laugh!";

export function paypalDonateAmount(cents?: number) {
  if (!cents || cents < 100) return undefined;
  return (cents / 100).toFixed(2);
}
