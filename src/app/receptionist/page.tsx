import { redirect } from 'next/navigation';
import { getReceptionistPath } from '@/lib/routes';

export default function ReceptionistIndexPage() {
  redirect(getReceptionistPath('/patients'));
}
