'use client';

import EMRView from './EMRView';

interface EMRServosViewProps {
  userId: string;
  onBack: () => void;
  congregations?: any[];
}

export default function EMRServosView({
  userId,
  onBack,
  congregations = []
}: EMRServosViewProps) {
  return (
    <EMRView 
      userId={userId}
      onBack={onBack}
      congregations={congregations}
      initialSchoolType="servants"
    />
  );
}
