import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/pageMeta';
import { UnvibeWebApp } from './web-app';

export const metadata: Metadata = pageMetadata({
  path: '/app',
  title: 'Web App',
  description: 'Select or paste code and understand what it does with Unvibe.',
});

export default function AppPage() {
  return <UnvibeWebApp />;
}
