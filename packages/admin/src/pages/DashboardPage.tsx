import { ActionItemsBlock } from '../components/dashboard/ActionItemsBlock'
import { ActivityBlock } from '../components/dashboard/ActivityBlock'
import { EasterEggsBlock } from '../components/dashboard/EasterEggsBlock'
import { HealthBlock } from '../components/dashboard/HealthBlock'
import { KiosksBlock } from '../components/dashboard/KiosksBlock'
import { ReadinessBlock } from '../components/dashboard/ReadinessBlock'
import { RecentBidsBlock } from '../components/dashboard/RecentBidsBlock'
import { RecentNominationsBlock } from '../components/dashboard/RecentNominationsBlock'
import { RefreshIndicator } from '../components/dashboard/RefreshIndicator'
import { TodayBlock } from '../components/dashboard/TodayBlock'

export function DashboardPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary">Dashboard</h1>
        <RefreshIndicator />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <KiosksBlock />
        <div className="flex flex-col gap-4">
          <HealthBlock />
          <EasterEggsBlock />
        </div>
        <div className="flex flex-col gap-4">
          <TodayBlock />
          <ActionItemsBlock />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <RecentBidsBlock />
        <RecentNominationsBlock />
      </div>

      <div className="mt-4">
        <ReadinessBlock />
      </div>
      <ActivityBlock />
    </div>
  )
}
