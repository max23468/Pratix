export type CommonSelectProps = {
  id?: string;
  value: string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export type CounterpartyOption = {
  id: string;
  kind: string;
  first_name?: string | null;
  last_name?: string | null;
  business_name?: string | null;
};

export const emptyCounterpartyOptions: CounterpartyOption[] = [];

export const emitSelectedValue = (onValueChange: (value: string) => void) => (value: string) => {
  if (!value) return;
  onValueChange(value);
};
