import React, { memo, useContext, useEffect, useMemo, useState } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import DashboardFooterClassic from './DashboardFooterClassic';
import DashboardFooterNoir from './noir/DashboardFooterNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import { useCacheLimitEnforcement } from '@/pages/dashboard/hooks/use-cache-limit-enforcement';
import { useEconomicUiMode } from '@/pages/dashboard/hooks/use-economic-ui-mode';
import { useMiniBackendMemoryStats } from '@/pages/dashboard/hooks/useMiniBackendMemoryStats';
import { getApiConfig } from '@/config/api';
import type { FooterMemoryMeterData } from './footer/FooterMemoryMeter';
import CalibrationOfferDialog from '../CalibrationOfferDialog';

const FamilyFooter = createFamilyComponent(DashboardFooterClassic, DashboardFooterNoir);

type FooterProps = React.ComponentProps<typeof FamilyFooter>;

interface FooterMemoryStatsPollerProps {
  localApiUrl: string;
  onData: (stats: FooterMemoryMeterData | null) => void;
}

function FooterMemoryStatsPoller({ localApiUrl, onData }: FooterMemoryStatsPollerProps): null {
  const stats = useMiniBackendMemoryStats(localApiUrl);
  useEffect(() => {
    onData(stats);
  }, [stats, onData]);
  return null;
}

const DashboardFooter = (props: FooterProps): React.JSX.Element => {
  useEconomicUiMode();
  useCacheLimitEnforcement();
  const [polledStats, setPolledStats] = useState<FooterMemoryMeterData | null>(null);
  const hasQueryClient = useContext(QueryClientContext) !== undefined;
  const localApiUrl = useMemo(() => {
    if (!hasQueryClient) return null;
    try {
      return getApiConfig().localUrl;
    } catch {
      return null;
    }
  }, [hasQueryClient]);
  return (
    <>
      {localApiUrl !== null && (
        <FooterMemoryStatsPoller localApiUrl={localApiUrl} onData={setPolledStats} />
      )}
      <FamilyFooter {...props} memoryStats={props.memoryStats ?? polledStats} />
      <CalibrationOfferDialog />
    </>
  );
};

export default memo(DashboardFooter);
