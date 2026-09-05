'use client';

import { useParams } from 'next/navigation';
import FieldServiceReportView from '@/components/FieldServiceReportView';

export default function PublicReportPage() {
  const params = useParams();
  const profileId = params.profileId as string;

  return (
    <div className="min-h-screen bg-[#FDFCFB]">
      <FieldServiceReportView 
        profileId={profileId} 
        isPublic={true} 
      />
    </div>
  );
}
