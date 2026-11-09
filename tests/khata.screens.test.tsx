import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { i18n, registerAppTranslations, todayISO } from '@skeleton/core';
import type { Language, Store } from '@skeleton/core';
import { deriveAll } from '../apps/khata/src/khata.reducers';
import type { KhataCollections, KhataData } from '../apps/khata/src/khata.types';
import type { ScreenProps } from '../apps/khata/src/screens/types';
import { AddCustomerScreen } from '../apps/khata/src/screens/AddCustomerScreen';
import { AddEntryScreen } from '../apps/khata/src/screens/AddEntryScreen';
import { CustomerDetailScreen } from '../apps/khata/src/screens/CustomerDetailScreen';
import { CustomerListScreen } from '../apps/khata/src/screens/CustomerListScreen';
import { DashboardScreen } from '../apps/khata/src/screens/DashboardScreen';
import { ReportsScreen } from '../apps/khata/src/screens/ReportsScreen';
import { ReverseEntryScreen } from '../apps/khata/src/screens/ReverseEntryScreen';
import { SettingsScreen } from '../apps/khata/src/screens/SettingsScreen';
import en from '../apps/khata/src/i18n/en.json';
import ur from '../apps/khata/src/i18n/ur.json';
import { rec } from './khata.helpers';

const TODAY = todayISO();
const OLD = '2000-01-01';

/**
 * Ahmed (has phone): credit Rs 5,000 today, payment Rs 1,000, credit Rs 2,000 today REVERSED → owes Rs 4,000
 * Tariq (no phone):  credit Rs 1,500                                                     → owes Rs 1,500
 * Sara:              credit Rs 1,000 + payment Rs 1,000                                  → settled
 * Fatima:            payment Rs 500 today                                                → advance Rs 500
 */
const DATA: KhataData = {
  customerCreated: [
    rec('customerCreated', { name: 'Ahmed Ali', phone: '03001234567', note: 'Regular' }, 'ahmed', 1),
    rec('customerCreated', { name: 'Tariq Mehmood' }, 'tariq', 2),
    rec('customerCreated', { name: 'Sara Begum' }, 'sara', 3),
    rec('customerCreated', { name: 'Fatima Noor', phone: '03331234567' }, 'fatima', 4),
  ],
  customerUpdated: [],
  creditGiven: [
    rec('creditGiven', { customerId: 'ahmed', amountPaisa: 500000, date: TODAY, note: 'Ration' }, 'a1', 10),
    rec('creditGiven', { customerId: 'ahmed', amountPaisa: 200000, date: TODAY, note: 'typo' }, 'a3', 12),
    rec('creditGiven', { customerId: 'tariq', amountPaisa: 150000, date: OLD }, 't1', 13),
    rec('creditGiven', { customerId: 'sara', amountPaisa: 100000, date: OLD }, 's1', 14),
  ],
  paymentReceived: [
    rec('paymentReceived', { customerId: 'ahmed', amountPaisa: 100000, date: OLD }, 'a2', 11),
    rec('paymentReceived', { customerId: 'sara', amountPaisa: 100000, date: OLD }, 's2', 15),
    rec('paymentReceived', { customerId: 'fatima', amountPaisa: 50000, date: TODAY }, 'f1', 16),
  ],
  entryReversed: [rec('entryReversed', { entryId: 'a3', reason: 'Typed wrong amount' }, 'r1', 17)],
  settingsUpdated: [],
};

function mockStore() {
  let n = 0;
  const add = vi.fn(async (collection: string, payload: unknown) => ({
    id: `new-${++n}`,
    createdAt: new Date().toISOString(),
    deviceId: 'test',
    collection,
    payload,
  }));
  return { add, store: { add } as unknown as Store<KhataCollections> };
}

function makeProps(language: Language = 'en') {
  const { store, add } = mockStore();
  const navigate = vi.fn();
  const onChanged = vi.fn(async () => {});
  const changeLanguage = vi.fn(async () => {});
  const props: ScreenProps = {
    data: DATA,
    derived: deriveAll(DATA, TODAY),
    store,
    navigate,
    onChanged,
    language,
    changeLanguage,
  };
  return { props, add, navigate, onChanged, changeLanguage };
}

const KEY_LEAK = /khata\.[a-z]+\.[a-zA-Z]+/;

beforeAll(() => {
  registerAppTranslations({ en, ur });
});

afterEach(async () => {
  cleanup(); // unmount first, so the language reset below doesn't re-render a mounted screen
  await i18n.changeLanguage('en');
});

describe.each([
  ['en', 'English'],
  ['ur', 'Urdu'],
] as const)('every screen renders in %s (%s)', (language) => {
  const screens: Array<[string, (p: ScreenProps) => React.ReactElement]> = [
    ['Dashboard', (p) => <DashboardScreen {...p} />],
    ['CustomerList', (p) => <CustomerListScreen {...p} />],
    ['AddCustomer', (p) => <AddCustomerScreen {...p} />],
    ['EditCustomer', (p) => <AddCustomerScreen {...p} customerId="ahmed" />],
    ['CustomerDetail', (p) => <CustomerDetailScreen {...p} customerId="ahmed" />],
    ['CustomerDetail (no phone, owes)', (p) => <CustomerDetailScreen {...p} customerId="tariq" />],
    ['CustomerDetail (unknown)', (p) => <CustomerDetailScreen {...p} customerId="ghost" />],
    ['AddEntry credit', (p) => <AddEntryScreen {...p} customerId="ahmed" type="credit" />],
    ['AddEntry payment', (p) => <AddEntryScreen {...p} customerId="ahmed" type="payment" />],
    ['ReverseEntry', (p) => <ReverseEntryScreen {...p} customerId="ahmed" entryId="a1" />],
    ['ReverseEntry (already reversed)', (p) => <ReverseEntryScreen {...p} customerId="ahmed" entryId="a3" />],
    ['ReverseEntry (unknown)', (p) => <ReverseEntryScreen {...p} customerId="ahmed" entryId="nope" />],
    ['Reports', (p) => <ReportsScreen {...p} />],
    ['Settings', (p) => <SettingsScreen {...p} />],
  ];

  it.each(screens)('%s shows no raw translation keys and uses the right direction', async (_name, build) => {
    await i18n.changeLanguage(language);
    const { props } = makeProps(language);
    const { container } = render(build(props));

    expect(container.textContent ?? '').not.toMatch(KEY_LEAK);
    expect(container.textContent?.trim().length).toBeGreaterThan(0);
    expect(document.documentElement.dir).toBe(language === 'ur' ? 'rtl' : 'ltr');
    expect(document.documentElement.lang).toBe(language);
  });
});

describe('Urdu text appears on screen', () => {
  it('dashboard and customer detail use Urdu words', async () => {
    await i18n.changeLanguage('ur');
    const { props } = makeProps('ur');
    const dashboard = render(<DashboardScreen {...props} />);
    expect(screen.getByText('کل بقایا')).toBeTruthy();
    expect(screen.getByText('آج')).toBeTruthy();
    dashboard.unmount();

    render(<CustomerDetailScreen {...props} customerId="ahmed" />);
    expect(screen.getByRole('button', { name: 'ادھار دیں' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ادائیگی لیں' })).toBeTruthy();
    expect(screen.getByText('یاد دہانی بھیجیں')).toBeTruthy();
  });

  it('amounts stay in Rs with separators and are forced left-to-right inside Urdu text', async () => {
    await i18n.changeLanguage('ur');
    const { props } = makeProps('ur');
    render(<DashboardScreen {...props} />);
    const total = screen.getByText('Rs 5,500');
    expect(total.getAttribute('dir')).toBe('ltr');
  });
});

describe('Dashboard', () => {
  it('shows total outstanding, todays credit and payments, and the top debtors (reversed entries excluded)', () => {
    const { props } = makeProps();
    render(<DashboardScreen {...props} />);
    expect(screen.getByText('Rs 5,500')).toBeTruthy(); // 4,000 + 1,500
    expect(screen.getByText('Rs 5,000')).toBeTruthy(); // credit today: Rs 5,000 (Rs 2,000 reversed is excluded)
    expect(screen.getByText('Rs 500')).toBeTruthy(); // payments today
    expect(screen.getByText('Ahmed Ali')).toBeTruthy();
    expect(screen.getByText('Tariq Mehmood')).toBeTruthy();
    expect(screen.queryByText('Sara Begum')).toBeNull(); // settled, not a debtor
  });

  it('colours owed amounts red and received amounts green', () => {
    const { props } = makeProps();
    render(<DashboardScreen {...props} />);
    expect(screen.getByText('Rs 5,500').className).toContain('text-red-600');
    expect(screen.getByText('Rs 500').className).toContain('text-green-700');
  });

  it('opens a debtor when tapped', () => {
    const { props, navigate } = makeProps();
    render(<DashboardScreen {...props} />);
    fireEvent.click(screen.getByText('Ahmed Ali'));
    expect(navigate).toHaveBeenCalledWith({ name: 'customerDetail', customerId: 'ahmed' });
  });

  it('says so when nobody owes anything', () => {
    const { props } = makeProps();
    const empty: KhataData = { ...DATA, creditGiven: [], paymentReceived: [], entryReversed: [] };
    render(<DashboardScreen {...props} data={empty} derived={deriveAll(empty, TODAY)} />);
    expect(screen.getByText('No one owes money right now')).toBeTruthy();
  });
});

describe('Customer list', () => {
  it('lists customers with the highest balance first and a status word beside each amount', () => {
    const { props } = makeProps();
    const { container } = render(<CustomerListScreen {...props} />);
    const text = container.textContent ?? '';
    const order = ['Ahmed Ali', 'Tariq Mehmood', 'Sara Begum', 'Fatima Noor'].map((n) => text.indexOf(n));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(screen.getByText('Rs 4,000').className).toContain('text-red-600');
    expect(screen.getByText('Rs 0').className).toContain('text-green-700');
    expect(screen.getByText('-Rs 500').className).toContain('text-green-700');
    expect(screen.getAllByText('Owes')).toHaveLength(2);
    expect(screen.getByText('Settled')).toBeTruthy();
    expect(screen.getByText('Advance')).toBeTruthy();
  });

  it('filters by name and by phone as you type', () => {
    const { props } = makeProps();
    render(<CustomerListScreen {...props} />);
    const search = screen.getByLabelText('Search name or phone');

    fireEvent.change(search, { target: { value: 'sara' } });
    expect(screen.getByText('Sara Begum')).toBeTruthy();
    expect(screen.queryByText('Ahmed Ali')).toBeNull();

    fireEvent.change(search, { target: { value: '0333' } });
    expect(screen.getByText('Fatima Noor')).toBeTruthy();
    expect(screen.queryByText('Sara Begum')).toBeNull();

    fireEvent.change(search, { target: { value: 'nobody' } });
    expect(screen.getByText('No customer found')).toBeTruthy();
  });

  it('opens a customer and the add-customer form', () => {
    const { props, navigate } = makeProps();
    render(<CustomerListScreen {...props} />);
    fireEvent.click(screen.getByText('Tariq Mehmood'));
    expect(navigate).toHaveBeenCalledWith({ name: 'customerDetail', customerId: 'tariq' });
    fireEvent.click(screen.getByRole('button', { name: 'Add Customer' }));
    expect(navigate).toHaveBeenCalledWith({ name: 'addCustomer' });
  });

  it('shows a friendly message when there are no customers', () => {
    const { props } = makeProps();
    const empty: KhataData = { ...DATA, customerCreated: [] };
    render(<CustomerListScreen {...props} derived={deriveAll(empty, TODAY)} />);
    expect(screen.getByText(/No customers yet/)).toBeTruthy();
  });
});

describe('Add customer', () => {
  it('requires a name', () => {
    const { props, add } = makeProps();
    render(<AddCustomerScreen {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save Customer' }));
    expect(screen.getByRole('alert').textContent).toBe('Name is required');
    expect(add).not.toHaveBeenCalled();
  });

  it('rejects an invalid phone but allows a blank one', async () => {
    const { props, add, navigate } = makeProps();
    render(<AddCustomerScreen {...props} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ali Raza' } });
    fireEvent.change(screen.getByLabelText('Phone (optional)'), { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Customer' }));
    expect(screen.getByRole('alert').textContent).toContain('valid Pakistani mobile number');
    expect(add).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Phone (optional)'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Customer' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'customerList' }));
    expect(add).toHaveBeenCalledWith('customerCreated', { name: 'Ali Raza' });
  });

  it('saves a trimmed name, a normalised phone and the note, then returns to the list', async () => {
    const { props, add, navigate, onChanged } = makeProps();
    render(<AddCustomerScreen {...props} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Ali Raza  ' } });
    fireEvent.change(screen.getByLabelText('Phone (optional)'), { target: { value: '0300-1234567' } });
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: 'Neighbour' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Customer' }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'customerList' }));
    expect(add).toHaveBeenCalledWith('customerCreated', {
      name: 'Ali Raza',
      phone: '03001234567',
      note: 'Neighbour',
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it('shows an error and stays on the form if saving fails', async () => {
    const { props, add, navigate } = makeProps();
    add.mockRejectedValueOnce(new Error('disk full'));
    render(<AddCustomerScreen {...props} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ali' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Customer' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Something went wrong'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('edit mode saves only the changed fields as an append-only customerUpdated record', async () => {
    const { props, add, navigate } = makeProps();
    render(<AddCustomerScreen {...props} customerId="ahmed" />);
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Ahmed Ali');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ahmed Ali Khan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Customer' }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'customerDetail', customerId: 'ahmed' }));
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith('customerUpdated', { customerId: 'ahmed', name: 'Ahmed Ali Khan' });
  });

  it('edit mode with no changes writes nothing', async () => {
    const { props, add, navigate } = makeProps();
    render(<AddCustomerScreen {...props} customerId="ahmed" />);
    fireEvent.click(screen.getByRole('button', { name: 'Save Customer' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(add).not.toHaveBeenCalled();
  });
});

describe('Customer detail', () => {
  it('shows the balance, customer info and both action buttons', () => {
    const { props, navigate } = makeProps();
    render(<CustomerDetailScreen {...props} customerId="ahmed" />);
    expect(screen.getByText('Ahmed Ali')).toBeTruthy();
    expect(screen.getByText('03001234567')).toBeTruthy();
    expect(screen.getAllByText('Rs 4,000')[0].className).toContain('text-red-600');

    fireEvent.click(screen.getByRole('button', { name: 'Credit Given' }));
    expect(navigate).toHaveBeenCalledWith({ name: 'addEntry', customerId: 'ahmed', type: 'credit' });
    fireEvent.click(screen.getByRole('button', { name: 'Payment Received' }));
    expect(navigate).toHaveBeenCalledWith({ name: 'addEntry', customerId: 'ahmed', type: 'payment' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(navigate).toHaveBeenCalledWith({ name: 'editCustomer', customerId: 'ahmed' });
  });

  it('lists the history newest first, with running balances, notes and colours', () => {
    const { props } = makeProps();
    const { container } = render(<CustomerDetailScreen {...props} customerId="ahmed" />);
    const items = Array.from(container.querySelectorAll('section[aria-labelledby="history-heading"] li'));
    expect(items).toHaveLength(3);
    // newest first: reversed credit (a3), payment (a2), credit (a1)
    expect(items[0].textContent).toContain('Typed wrong amount');
    expect(items[1].textContent).toContain('Payment');
    expect(items[2].textContent).toContain('Ration');
    expect(items[2].textContent).toContain('Balance:');
  });

  it('shows a reversed entry struck through, labelled Reversed, with its reason and no correct button', () => {
    const { props } = makeProps();
    const { container } = render(<CustomerDetailScreen {...props} customerId="ahmed" />);
    const reversed = container.querySelector('li.bg-gray-50');
    expect(reversed).not.toBeNull();
    expect(reversed?.textContent).toContain('Reversed');
    expect(reversed?.textContent).toContain('Reason: Typed wrong amount');
    expect(reversed?.querySelector('.line-through')).not.toBeNull();
    expect(reversed?.querySelector('button')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Correct Mistake' })).toHaveLength(2);
  });

  it('opens the correction screen for a live entry', () => {
    const { props, navigate } = makeProps();
    render(<CustomerDetailScreen {...props} customerId="ahmed" />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Correct Mistake' })[1]);
    expect(navigate).toHaveBeenCalledWith({ name: 'reverseEntry', entryId: 'a1', customerId: 'ahmed' });
  });

  it('offers WhatsApp and SMS reminders only when the customer owes and has a phone', () => {
    const { props } = makeProps();
    const owes = render(<CustomerDetailScreen {...props} customerId="ahmed" />);
    const whatsapp = screen.getByRole('link', { name: 'Send Reminder' });
    const href = whatsapp.getAttribute('href') ?? '';
    expect(href.startsWith('https://wa.me/923001234567?text=')).toBe(true);
    expect(decodeURIComponent(href)).toContain('Rs 4,000');
    expect(decodeURIComponent(href)).toContain('Ahmed Ali');
    expect(decodeURIComponent(href)).toContain('My Shop');
    expect(whatsapp.getAttribute('target')).toBe('_blank');
    expect(whatsapp.getAttribute('rel')).toContain('noopener');
    expect(screen.getByRole('link', { name: 'Send by SMS' }).getAttribute('href')).toMatch(
      /^sms:03001234567\?body=/,
    );
    owes.unmount();

    const noPhone = render(<CustomerDetailScreen {...props} customerId="tariq" />);
    expect(screen.queryByRole('link', { name: 'Send Reminder' })).toBeNull();
    expect(screen.getByText('Add a phone number to send reminders')).toBeTruthy();
    noPhone.unmount();

    const settled = render(<CustomerDetailScreen {...props} customerId="sara" />);
    expect(screen.queryByRole('link', { name: 'Send Reminder' })).toBeNull();
    expect(screen.queryByText('Add a phone number to send reminders')).toBeNull();
    settled.unmount();

    render(<CustomerDetailScreen {...props} customerId="fatima" />); // advance, has phone
    expect(screen.queryByRole('link', { name: 'Send Reminder' })).toBeNull();
  });

  it('writes the reminder in Urdu when the app is in Urdu', async () => {
    await i18n.changeLanguage('ur');
    const { props } = makeProps('ur');
    render(<CustomerDetailScreen {...props} customerId="ahmed" />);
    const href = screen.getByRole('link', { name: 'یاد دہانی بھیجیں' }).getAttribute('href') ?? '';
    expect(decodeURIComponent(href)).toContain('السلام علیکم');
    expect(decodeURIComponent(href)).toContain('میری دکان');
  });

  it('tells the user when the customer does not exist', () => {
    const { props } = makeProps();
    render(<CustomerDetailScreen {...props} customerId="ghost" />);
    expect(screen.getByText('Customer not found')).toBeTruthy();
  });
});

describe('Add entry', () => {
  async function submitAmount(text: string, type: 'credit' | 'payment' = 'credit') {
    const ctx = makeProps();
    render(<AddEntryScreen {...ctx.props} customerId="ahmed" type={type} />);
    fireEvent.change(screen.getByLabelText('Amount (Rs)'), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    return ctx;
  }

  it('saves a credit in paisa with todays date, then returns to the customer', async () => {
    const { add, navigate, onChanged } = await submitAmount('2000');
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'customerDetail', customerId: 'ahmed' }));
    expect(add).toHaveBeenCalledWith('creditGiven', { customerId: 'ahmed', amountPaisa: 200000, date: TODAY });
    expect(onChanged).toHaveBeenCalled();
  });

  it('saves a payment as paymentReceived', async () => {
    const { add, navigate } = await submitAmount('750', 'payment');
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(add).toHaveBeenCalledWith('paymentReceived', { customerId: 'ahmed', amountPaisa: 75000, date: TODAY });
  });

  it('accepts Urdu digits and thousand separators', async () => {
    const urdu = await submitAmount('۲۵۰۰');
    await waitFor(() => expect(urdu.add).toHaveBeenCalled());
    expect(urdu.add.mock.calls[0][1]).toMatchObject({ amountPaisa: 250000 });
  });

  it('keeps the note and a changed date', async () => {
    const { props, add, navigate } = makeProps();
    render(<AddEntryScreen {...props} customerId="ahmed" type="credit" />);
    fireEvent.change(screen.getByLabelText('Amount (Rs)'), { target: { value: '300' } });
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: '  Sugar  ' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-01-15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(add).toHaveBeenCalledWith('creditGiven', {
      customerId: 'ahmed',
      amountPaisa: 30000,
      date: '2026-01-15',
      note: 'Sugar',
    });
  });

  it.each([
    ['', 'Amount is required'],
    ['0', 'Enter a whole number of rupees'],
    ['12.5', 'Enter a whole number of rupees'],
    ['-100', 'Enter a whole number of rupees'],
    ['abc', 'Enter a whole number of rupees'],
    ['12345678901', 'Enter a whole number of rupees'],
  ])('rejects the amount %j with a message', async (text, message) => {
    const { add } = await submitAmount(text);
    expect(screen.getByRole('alert').textContent).toContain(message);
    expect(add).not.toHaveBeenCalled();
  });

  it('rejects an empty date', () => {
    const { props, add } = makeProps();
    render(<AddEntryScreen {...props} customerId="ahmed" type="credit" />);
    fireEvent.change(screen.getByLabelText('Amount (Rs)'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a valid date');
    expect(add).not.toHaveBeenCalled();
  });

  it('defaults the date to today and uses a big numeric field', () => {
    const { props } = makeProps();
    render(<AddEntryScreen {...props} customerId="ahmed" type="credit" />);
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe(TODAY);
    const amount = screen.getByLabelText('Amount (Rs)') as HTMLInputElement;
    expect(amount.getAttribute('inputmode')).toBe('numeric');
    expect(amount.className).toContain('min-h-[56px]');
  });

  it('previews the amount as Rs with separators', () => {
    const { props } = makeProps();
    render(<AddEntryScreen {...props} customerId="ahmed" type="payment" />);
    fireEvent.change(screen.getByLabelText('Amount (Rs)'), { target: { value: '1250000' } });
    expect(screen.getByText('Rs 1,250,000')).toBeTruthy();
  });
});

describe('Reverse entry', () => {
  it('shows the original entry and requires a reason', () => {
    const { props, add } = makeProps();
    render(<ReverseEntryScreen {...props} customerId="ahmed" entryId="a1" />);
    expect(screen.getByText('Rs 5,000')).toBeTruthy();
    expect(screen.getByText('Ration')).toBeTruthy();
    expect(screen.getByText('Credit')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Reversal' }));
    expect(screen.getByRole('alert').textContent).toBe('Reason is required');
    expect(add).not.toHaveBeenCalled();
  });

  it('appends an entryReversed record (never edits or deletes) and returns to the customer', async () => {
    const { props, add, navigate, onChanged } = makeProps();
    render(<ReverseEntryScreen {...props} customerId="ahmed" entryId="a1" />);
    fireEvent.change(screen.getByLabelText('Reason for reversal (required)'), { target: { value: ' Wrong amount ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Reversal' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'customerDetail', customerId: 'ahmed' }));
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith('entryReversed', { entryId: 'a1', reason: 'Wrong amount' });
    expect(onChanged).toHaveBeenCalled();
  });

  it('does not allow reversing an entry twice', () => {
    const { props } = makeProps();
    render(<ReverseEntryScreen {...props} customerId="ahmed" entryId="a3" />);
    expect(screen.getByText('This entry is already reversed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirm Reversal' })).toBeNull();
  });

  it('handles an unknown entry', () => {
    const { props } = makeProps();
    render(<ReverseEntryScreen {...props} customerId="ahmed" entryId="nope" />);
    expect(screen.getByText('Entry not found')).toBeTruthy();
  });
});

describe('Reports', () => {
  it('defaults to this month and totals credit, payments and net (payments minus credit)', () => {
    const { props } = makeProps();
    render(<ReportsScreen {...props} />);
    expect(screen.getByText('Rs 5,000').className).toContain('text-red-600'); // credit given (Rs 2,000 reversed excluded)
    expect(screen.getByText('Rs 500').className).toContain('text-green-700'); // payments received
    expect(screen.getByText('-Rs 4,500').className).toContain('text-red-600'); // net = 500 − 5,000
  });

  it('recalculates for another range and ignores entries outside it', () => {
    const { props } = makeProps();
    render(<ReportsScreen {...props} />);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '1999-01-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2000-12-31' } });
    // 2000-01-01: credits 1,500 + 1,000, payments 1,000 + 1,000
    expect(screen.getByText('Rs 2,500')).toBeTruthy();
    expect(screen.getByText('Rs 2,000')).toBeTruthy();
    expect(screen.getByText('-Rs 500')).toBeTruthy();
  });

  it('warns when the start date is after the end date and shows no totals', () => {
    const { props } = makeProps();
    render(<ReportsScreen {...props} />);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2999-01-01' } });
    expect(screen.getByRole('alert').textContent).toBe('The start date must not be after the end date');
    expect(screen.queryByText('Net (payments minus credit)')).toBeNull();
  });
});

describe('Settings', () => {
  it('saves the shop name as a settingsUpdated record', async () => {
    const { props, add, onChanged } = makeProps();
    render(<SettingsScreen {...props} />);
    fireEvent.change(screen.getByLabelText('Shop Name'), { target: { value: '  Ahmed General Store ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saved'));
    expect(add).toHaveBeenCalledWith('settingsUpdated', { shopName: 'Ahmed General Store' });
    expect(onChanged).toHaveBeenCalled();
  });

  it('does not allow an empty shop name', () => {
    const { props, add } = makeProps();
    render(<SettingsScreen {...props} />);
    fireEvent.change(screen.getByLabelText('Shop Name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toBe('Shop name cannot be empty');
    expect(add).not.toHaveBeenCalled();
  });

  it('switches language through the radio buttons', () => {
    const { props, changeLanguage } = makeProps();
    render(<SettingsScreen {...props} />);
    expect((screen.getByLabelText('English') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText('اردو'));
    expect(changeLanguage).toHaveBeenCalledWith('ur');
  });

  it('exports a CSV download without any network call', () => {
    const createObjectURL = vi.fn(() => 'blob:fake');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { props } = makeProps();
    render(<SettingsScreen {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download Data (CSV)' }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toContain('text/csv');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    expect(fetchSpy).not.toHaveBeenCalled();

    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it('asks for confirmation before loading demo data, and Cancel adds nothing', () => {
    const { props, add } = makeProps();
    render(<SettingsScreen {...props} />);
    expect(screen.getByText('Adds sample data for demonstration')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Load Demo Data' }));
    expect(screen.getByRole('alertdialog').textContent).toContain('This will add sample customers');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(add).not.toHaveBeenCalled();
  });

  it('loads the demo data once confirmed and refreshes the app', async () => {
    const { props, add, onChanged } = makeProps();
    render(<SettingsScreen {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load Demo Data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, add sample data' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Sample data added'));
    expect(add.mock.calls.filter((c) => c[0] === 'customerCreated').length).toBeGreaterThanOrEqual(5);
    expect(add.mock.calls.some((c) => c[0] === 'entryReversed')).toBe(true);
    expect(onChanged).toHaveBeenCalled();
  });
});
