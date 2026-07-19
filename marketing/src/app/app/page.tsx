import type { Metadata } from 'next';
import { UnvibeWebApp } from './web-app';

export const metadata: Metadata = {
  title: 'Web App',
  description: 'Select or paste code and understand what it does with Unvibe.',
};

export default function AppPage() {
  return <UnvibeWebApp />;
}
