import { useApp } from "@/lib/store";
import type { Screen } from "@/lib/types";
import { HomeScreen } from "./home/HomeScreen";
import { DashboardScreen } from "./DashboardScreen";
import { GroupScreen } from "./GroupScreen";
import { AdminScreen } from "./AdminScreen";
import { CreateScreen } from "./CreateScreen";
import { PayScreen } from "./PayScreen";
import { QrScreen } from "./QrScreen";
import { ApproveScreen } from "./ApproveScreen";
import { WalletScreen } from "./WalletScreen";
import { FxScreen } from "./FxScreen";
import { DepositScreen } from "./DepositScreen";
import { HistoryScreen } from "./HistoryScreen";
import { NotificationsScreen } from "./NotificationsScreen";
import { ProfileScreen } from "./ProfileScreen";

/** Maps each state-machine screen to its component. */
const SCREENS: Record<Screen, React.ComponentType> = {
  home: HomeScreen,
  dashboard: DashboardScreen,
  group: GroupScreen,
  admin: AdminScreen,
  create: CreateScreen,
  pay: PayScreen,
  qr: QrScreen,
  approve: ApproveScreen,
  wallet: WalletScreen,
  fx: FxScreen,
  deposit: DepositScreen,
  history: HistoryScreen,
  notifications: NotificationsScreen,
  profile: ProfileScreen,
};

/** Renders the screen for the current navigation state. */
export function ScreenRouter() {
  const { state } = useApp();
  const Screen = SCREENS[state.screen];
  return <Screen />;
}
