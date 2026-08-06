export type ProfileForm = {
  full_name: string;
  business_name: string;
  vat_number: string;
  tax_code: string;
  email: string;
  phone: string;
  pec: string;
  bar_association: string;
  address_street: string;
  address_zip: string;
  address_city: string;
  address_province: string;
  address_country: string;
  tax_regime: "ordinario" | "forfettario";
  cassa_rate: number;
  vat_rate: number;
  withholding_rate: number;
  apply_withholding: boolean;
  include_stamp_duty: boolean;
  bank_name: string;
  iban: string;
  invoice_number_prefix: string;
  invoice_year: number;
  invoice_next_number: number;
  notes: string;
};

export type SetProfileField = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => void;
