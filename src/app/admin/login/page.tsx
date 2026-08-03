import { redirect } from 'next/navigation';
import { ADMIN_LOGIN_PATH } from '@/lib/routes';

export default function AdminLoginRedirectPage() {
  redirect(ADMIN_LOGIN_PATH);
}
