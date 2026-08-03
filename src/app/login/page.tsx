import { redirect } from 'next/navigation';
import { ADMIN_LOGIN_PATH } from '@/lib/routes';

export default function LoginPage() {
  redirect(ADMIN_LOGIN_PATH);
}
