import { useState, useMemo, useEffect, useRef } from "react";
import {
  Home,
  Bell,
  FileText,
  Globe,
  Settings,
  Search,
  ChevronDown,
  Plus,
  ArrowRight,
  MoreVertical,
  Users,
  Landmark,
  Calendar,
  Package,
  X,
  ExternalLink,
  Check,
  RefreshCw,
  Trash2,
  LogOut,
  LayoutDashboard,
  Eye,
  ChevronRight,
  Mail,
  ArrowLeft,
  Filter,
  CheckCircle2,
  Shield,
  Smartphone,
  Download,
  Copy,
  AlertTriangle,
  Edit3,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../auth/auth-context";
import "./dashboard.css";

/* ====================================================================
   INTERFACES
   ==================================================================== */

interface WatchItem {
  id: string;
  name: string;
  url: string;
  status: "no-change" | "change-detected" | "needs-look" | "paused";
  lastChecked: string;
  category: "gov" | "visa" | "edu" | "jobs" | "other";
  tellMeIf: string;
  checkEvery: string;
  checksLast24h: number[];
  noisyBitsSkipped: number;
}

interface ChangeItem {
  id: string;
  watchId: string;
  title: string;
  note: string;
  summary: string;
  time: string;
  dotColor: "red" | "green" | "amber";
  noisyBitsSkipped: number;
}

interface DiffLine {
  lineNum: number;
  content: string;
  type: "unchanged" | "added" | "removed" | "noise";
  annotation?: string;
  noiseCategory?: string;
}

interface SkippedItem {
  label: string;
  count: number;
  category: string;
}

interface PublicWatch {
  id: string;
  title: string;
  url: string;
  followers: string;
  iconType: "gov" | "visa" | "edu";
  description: string;
  checkEvery: string;
  since: string;
}

interface LogbookEntry {
  id: string;
  type: "change" | "quiet-stretch";
  date: string;
  time: string;
  title?: string;
  description?: string;
  noisyBitsSkipped?: number;
  quietChecks?: number;
  quietDays?: number;
  isLatest?: boolean;
}

interface ToastMessage {
  id: string;
  type: "success" | "info" | "error";
  text: string;
}

interface ConnectedDevice {
  id: string;
  name: string;
  type: "desktop" | "mobile";
  isCurrent: boolean;
  lastActive: string;
}

interface DashboardProps {
  onSwitchToLanding?: () => void;
}

function generateSparkline(changed: boolean): number[] {
  const bars: number[] = [];
  for (let i = 0; i < 24; i++) {
    if (changed && i === 22) bars.push(2);
    else if (Math.random() < 0.08) bars.push(0);
    else bars.push(1);
  }
  return bars;
}

export function Dashboard({ onSwitchToLanding }: DashboardProps) {
  const { user, logout, updateUserProfile } = useAuth();
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* Navigation & View State */
  const [activeTab, setActiveTab] = useState<string>("home");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [activeMenuWatchId, setActiveMenuWatchId] = useState<string | null>(null);
  const [ledgerFilter, setLedgerFilter] = useState<string>("everything");
  const [activeDiffWatchId, setActiveDiffWatchId] = useState<string | null>(null);
  const [activeLogbookWatch, setActiveLogbookWatch] = useState<PublicWatch | null>(null);

  /* Toast Notification State */
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (text: string, type: "success" | "info" | "error" = "success") => {
    const id = "toast_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  /* Global Keyboard Shortcut: '/' to focus search */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* User Plan State */
  const [userPlan, setUserPlan] = useState<"Free" | "Pro" | "Team">(() => {
    try {
      const saved = localStorage.getItem("checkon_user_plan");
      if (saved === "Pro" || saved === "Team") return saved;
    } catch { /* ignore */ }
    return "Free";
  });
  useEffect(() => {
    try {
      localStorage.setItem("checkon_user_plan", userPlan);
    } catch { /* ignore */ }
  }, [userPlan]);

  /* Modals State */
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditWatchModalOpen, setIsEditWatchModalOpen] = useState<boolean>(false);
  const [editingWatch, setEditingWatch] = useState<WatchItem | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState<boolean>(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false);
  const [is2FAModalOpen, setIs2FAModalOpen] = useState<boolean>(false);
  const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState<boolean>(false);
  const [isDeleteAccountConfirmOpen, setIsDeleteAccountConfirmOpen] = useState<boolean>(false);
  const [isEmbedModalOpen, setIsEmbedModalOpen] = useState<boolean>(false);

  /* Form Inputs for Edit Profile */
  const [profileNameInput, setProfileNameInput] = useState(user?.fullName || "");
  const [profileEmailInput, setProfileEmailInput] = useState(user?.email || "");
  const [profileRoleInput, setProfileRoleInput] = useState("Product Analyst");

  /* Form Inputs for Change Password */
  const [currPassword, setCurrPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  /* 2FA State */
  const [is2FAEnabled, setIs2FAEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem("checkon_2fa_enabled") === "true";
    } catch {
      return false;
    }
  });
  const [twoFactorCode, setTwoFactorCode] = useState("");

  /* Delete Account Confirmation Text */
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  /* Devices State */
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>(() => {
    try {
      const saved = localStorage.getItem("checkon_connected_devices");
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return [
      { id: "dev-win", name: "Chrome on Windows", type: "desktop", isCurrent: true, lastActive: "just now" },
      { id: "dev-ios", name: "Safari on iPhone", type: "mobile", isCurrent: false, lastActive: "2 days ago" },
      { id: "dev-mac", name: "Firefox on macOS", type: "desktop", isCurrent: false, lastActive: "5 days ago" },
    ];
  });
  useEffect(() => {
    try {
      localStorage.setItem("checkon_connected_devices", JSON.stringify(connectedDevices));
    } catch { /* ignore */ }
  }, [connectedDevices]);

  /* Notification Settings State */
  const [notifEmailAlerts, setNotifEmailAlerts] = useState<boolean>(() => {
    try { return localStorage.getItem("checkon_notif_email") !== "false"; } catch { return true; }
  });
  const [notifWeeklyDigest, setNotifWeeklyDigest] = useState<boolean>(() => {
    try { return localStorage.getItem("checkon_notif_digest") !== "false"; } catch { return true; }
  });
  const [notifPush, setNotifPush] = useState<boolean>(() => {
    try { return localStorage.getItem("checkon_notif_push") === "true"; } catch { return false; }
  });
  const [notifNoiseFiltering, setNotifNoiseFiltering] = useState<boolean>(() => {
    try { return localStorage.getItem("checkon_notif_noise") !== "false"; } catch { return true; }
  });

  /* Weekly Digest Settings */
  const [digestFrequency, setDigestFrequency] = useState<string>(() => {
    try { return localStorage.getItem("checkon_digest_freq") || "weekly"; } catch { return "weekly"; }
  });
  const [digestDeliveryTime, setDigestDeliveryTime] = useState<string>(() => {
    try { return localStorage.getItem("checkon_digest_time") || "08:00"; } catch { return "08:00"; }
  });
  const [includeQuietWatches, setIncludeQuietWatches] = useState<boolean>(() => {
    try { return localStorage.getItem("checkon_digest_quiet") !== "false"; } catch { return true; }
  });

  /* Logbook Subscribe State */
  const [logbookEmail, setLogbookEmail] = useState("");
  const [subscribedWatches, setSubscribedWatches] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("checkon_subscribed_watches");
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return {};
  });

  /* Diff Inspector State */
  const [diffViewTab, setDiffViewTab] = useState<"all" | "mattered" | "skipped">("all");
  const [showMarginNotes, setShowMarginNotes] = useState<boolean>(true);
  const [activeSkippedFilter, setActiveSkippedFilter] = useState<string | null>(null);

  /* Clean out old keys */
  useEffect(() => {
    try {
      localStorage.removeItem("checkon_user_watches");
      localStorage.removeItem("checkon_user_changes");
    } catch { /* ignore */ }
  }, []);

  /* Active Watches */
  const [watches, setWatches] = useState<WatchItem[]>(() => {
    try {
      const saved = localStorage.getItem("checkon_active_watches");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((w: any) => ({
            ...w,
            tellMeIf: w.tellMeIf || "any meaningful content change",
            checkEvery: w.checkEvery || "15m",
            checksLast24h: w.checksLast24h || generateSparkline(w.status === "change-detected"),
            noisyBitsSkipped: w.noisyBitsSkipped ?? 0,
          }));
        }
      }
    } catch { /* ignore */ }
    return [];
  });
  useEffect(() => {
    try {
      localStorage.setItem("checkon_active_watches", JSON.stringify(watches));
    } catch { /* ignore */ }
  }, [watches]);

  /* Followed Public Watches */
  const [followedIds, setFollowedIds] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("checkon_followed_ids");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === "object" && parsed !== null) return parsed;
      }
    } catch { /* ignore */ }
    return {};
  });
  useEffect(() => {
    try {
      localStorage.setItem("checkon_followed_ids", JSON.stringify(followedIds));
    } catch { /* ignore */ }
  }, [followedIds]);

  /* Total Checks Count */
  const [checksCompleted, setChecksCompleted] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("checkon_checks_count");
      return saved ? parseInt(saved, 10) : 142;
    } catch {
      return 142;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("checkon_checks_count", String(checksCompleted));
    } catch { /* ignore */ }
  }, [checksCompleted]);

  /* Recent Changes */
  const [recentChanges, setRecentChanges] = useState<ChangeItem[]>(() => {
    try {
      const saved = localStorage.getItem("checkon_active_changes");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((c: any) => ({
            ...c,
            watchId: c.watchId || "",
            summary: c.summary || c.note || "",
            noisyBitsSkipped: c.noisyBitsSkipped ?? 0,
          }));
        }
      }
    } catch { /* ignore */ }
    return [];
  });
  useEffect(() => {
    try {
      localStorage.setItem("checkon_active_changes", JSON.stringify(recentChanges));
    } catch { /* ignore */ }
  }, [recentChanges]);

  /* Form states for adding watch */
  const [newWatchName, setNewWatchName] = useState("");
  const [newWatchUrl, setNewWatchUrl] = useState("");
  const [newWatchTellMeIf, setNewWatchTellMeIf] = useState("");
  const [newWatchFrequency, setNewWatchFrequency] = useState("15m");

  /* Last visit string */
  const [lastVisit] = useState<string>(() => {
    const ts = localStorage.getItem("checkon_last_visit");
    const now = new Date().toISOString();
    localStorage.setItem("checkon_last_visit", now);
    if (ts) {
      const d = new Date(ts);
      return `${d.getDate()} ${d.toLocaleString("en", { month: "short" })}, ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    }
    return "just now";
  });

  /* Static Data Models */
  const publicWatches: PublicWatch[] = [
    {
      id: "p1",
      title: "UPSC Notifications",
      url: "https://upsc.gov.in/whats-new",
      followers: "1.2k followers",
      iconType: "gov",
      description: "New results, notices and exam calendars from the Commission's What's New page.",
      checkEvery: "every 10 min",
      since: "since 02 Mar 2026",
    },
    {
      id: "p2",
      title: "US Visa Slots — Mumbai",
      url: "https://ais.usvisa-info.com",
      followers: "980 followers",
      iconType: "visa",
      description: "Track available appointment slots for B1/B2 visa interviews at Mumbai.",
      checkEvery: "every 5 min",
      since: "since 15 Jan 2026",
    },
    {
      id: "p3",
      title: "Karnataka PGCET",
      url: "https://cetonline.karnataka.gov.in",
      followers: "642 followers",
      iconType: "edu",
      description: "Seat allotment results and counselling schedule updates.",
      checkEvery: "every 30 min",
      since: "since 10 Jun 2026",
    },
  ];

  const demoDiffLines: DiffLine[] = [
    { lineNum: 1, content: "Union Public Service Commission", type: "unchanged" },
    { lineNum: 2, content: "What’s New", type: "unchanged" },
    { lineNum: 3, content: "last updated: 17-09-2026 09:40:07", type: "noise", annotation: "just the clock", noiseCategory: "Timestamps" },
    { lineNum: 4, content: "Visitors: 18,402,977", type: "noise", annotation: "visitor counter", noiseCategory: "Visitor counter" },
    { lineNum: 5, content: "Swachhta Pakhwada 2026 → Hindi Pakhwada 2026", type: "noise", annotation: "banner rotates daily", noiseCategory: "Rotating banner" },
    { lineNum: 6, content: "Final Result: Civil Services Examination, 2026", type: "added", annotation: "this one!" },
    { lineNum: 7, content: "Marks of recommended candidates will be published within 15 days of the final result.", type: "added" },
    { lineNum: 8, content: "Written Result: Engineering Services (Main) Examination, 2026", type: "unchanged" },
    { lineNum: 9, content: "Notice: Revised schedule for Personality Test — Combined Geo-Scientist (Main) Examination, 2026", type: "unchanged" },
    { lineNum: 10, content: "Recruitment Test: Assistant Director (Cost) [#4] → [#5]", type: "noise", annotation: "only moved down", noiseCategory: "Reordered item" },
    { lineNum: 11, content: "Advertisement No. 14/2026 — Online Recruitment Applications (ORA)", type: "unchanged" },
  ];

  const demoSkippedItems: SkippedItem[] = [
    { label: "Timestamps", count: 3, category: "Timestamps" },
    { label: "Visitor counter", count: 1, category: "Visitor counter" },
    { label: "Rotating banner", count: 1, category: "Rotating banner" },
    { label: "Reordered item", count: 1, category: "Reordered item" },
    { label: "Session token", count: 1, category: "Session token" },
  ];

  const demoLogbookEntries: LogbookEntry[] = [
    { id: "l1", type: "change", date: "17 Sep 2026", time: "09:40 IST", title: "Final Result: Civil Services Examination, 2026", description: "Added to What’s New. Marks of recommended candidates to follow within 15 days.", noisyBitsSkipped: 7, isLatest: true },
    { id: "l2", type: "quiet-stretch", date: "", time: "", quietChecks: 1036, quietDays: 7 },
    { id: "l3", type: "change", date: "10 Sep 2026", time: "17:20 IST", title: "Notice: Revised schedule for Personality Test", description: "Interview dates for Batch 3 moved.", noisyBitsSkipped: 3 },
    { id: "l4", type: "quiet-stretch", date: "", time: "", quietChecks: 2218, quietDays: 15 },
    { id: "l5", type: "change", date: "26 Aug 2026", time: "11:05 IST", title: "Written Result: Engineering Services (Main) Examination, 2026", description: "Result PDF linked from What’s New.", noisyBitsSkipped: 5 },
    { id: "l6", type: "quiet-stretch", date: "", time: "", quietChecks: 4380, quietDays: 30 },
    { id: "l7", type: "change", date: "27 Jul 2026", time: "10:12 IST", title: "Examination Calendar 2027 (Tentative)", description: "Calendar PDF published.", noisyBitsSkipped: 2 },
  ];

  /* Computed Ledger Groups */
  const changedWatches = watches.filter((w) => w.status === "change-detected");
  const quietWatches = watches.filter((w) => w.status === "no-change");
  const needsLookWatches = watches.filter((w) => w.status === "needs-look");

  const filteredWatches = useMemo(() => {
    let list = watches;
    if (ledgerFilter === "changed") list = changedWatches;
    else if (ledgerFilter === "quiet") list = quietWatches;
    else if (ledgerFilter === "needs-look") list = needsLookWatches;
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((w) => w.name.toLowerCase().includes(q) || w.url.toLowerCase().includes(q) || (w.tellMeIf || "").toLowerCase().includes(q));
  }, [watches, searchQuery, ledgerFilter, changedWatches, quietWatches, needsLookWatches]);

  /* Max Watches Quota based on Plan */
  const maxWatchesQuota = userPlan === "Free" ? 5 : userPlan === "Pro" ? 50 : 999;

  /* ====================================================================
     HANDLERS
     ==================================================================== */

  const handleToggleFollow = (id: string) => {
    const isCurrentlyFollowed = !!followedIds[id];
    setFollowedIds((prev) => ({ ...prev, [id]: !isCurrentlyFollowed }));
    const pub = publicWatches.find((p) => p.id === id);
    if (!pub) return;
    if (!isCurrentlyFollowed) {
      const newWatch: WatchItem = {
        id: "w_pub_" + pub.id,
        name: pub.title,
        url: pub.url,
        status: "no-change",
        lastChecked: "Just followed — checking now",
        category: pub.iconType,
        tellMeIf: "any meaningful content change",
        checkEvery: pub.checkEvery.replace("every ", ""),
        checksLast24h: generateSparkline(false),
        noisyBitsSkipped: 0,
      };
      setWatches((prev) => [newWatch, ...prev]);
      setChecksCompleted((prev) => prev + 1);
      showToast(`Now following "${pub.title}"! Added to your ledger.`, "success");
    } else {
      setWatches((prev) => prev.filter((w) => w.id !== "w_pub_" + pub.id));
      showToast(`Unfollowed "${pub.title}".`, "info");
    }
  };

  const handleAddWatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWatchUrl.trim()) return;

    if (watches.length >= maxWatchesQuota) {
      setIsAddModalOpen(false);
      setIsUpgradeModalOpen(true);
      showToast(`You've reached the ${userPlan} Plan limit of ${maxWatchesQuota} watches. Upgrade to add more!`, "error");
      return;
    }

    let cleanName = newWatchName.trim();
    if (!cleanName) {
      try {
        const u = new URL(newWatchUrl.startsWith("http") ? newWatchUrl : `https://${newWatchUrl}`);
        cleanName = u.hostname.replace("www.", "");
      } catch {
        cleanName = "New Web Watch";
      }
    }
    const created: WatchItem = {
      id: "w_" + Date.now(),
      name: cleanName,
      url: newWatchUrl.startsWith("http") ? newWatchUrl : `https://${newWatchUrl}`,
      status: "no-change",
      lastChecked: "Just added — checking now",
      category: "other",
      tellMeIf: newWatchTellMeIf.trim() || "any meaningful content change",
      checkEvery: newWatchFrequency,
      checksLast24h: generateSparkline(false),
      noisyBitsSkipped: 0,
    };
    setWatches((prev) => [created, ...prev]);
    setRecentChanges((prev) => [
      {
        id: "c_" + Date.now(),
        watchId: created.id,
        title: cleanName,
        note: "Watch created — initial check scheduled",
        summary: "Watch created — initial check scheduled",
        time: "Just now",
        dotColor: "green",
        noisyBitsSkipped: 0,
      },
      ...prev,
    ]);
    setChecksCompleted((prev) => prev + 1);
    setNewWatchName("");
    setNewWatchUrl("");
    setNewWatchTellMeIf("");
    setIsAddModalOpen(false);
    showToast(`Started monitoring "${cleanName}"!`, "success");
  };

  const handleEditWatchOpen = (watch: WatchItem) => {
    setEditingWatch({ ...watch });
    setIsEditWatchModalOpen(true);
    setActiveMenuWatchId(null);
  };

  const handleEditWatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWatch) return;
    setWatches((prev) => prev.map((w) => (w.id === editingWatch.id ? editingWatch : w)));
    setIsEditWatchModalOpen(false);
    showToast(`Updated watch settings for "${editingWatch.name}".`, "success");
  };

  const handleDeleteWatch = (id: string) => {
    const target = watches.find((w) => w.id === id);
    setWatches((prev) => prev.filter((w) => w.id !== id));
    if (target) {
      setRecentChanges((prev) => prev.filter((c) => c.title !== target.name));
      showToast(`Deleted watch "${target.name}".`, "info");
    }
    setActiveMenuWatchId(null);
  };

  const handleCheckNow = (id: string) => {
    const target = watches.find((w) => w.id === id);
    if (!target) return;
    setWatches((prev) =>
      prev.map((w) =>
        w.id === id
          ? {
              ...w,
              lastChecked: "Checked just now • No change",
              status: "no-change" as const,
              checksLast24h: [...w.checksLast24h.slice(1), 1],
            }
          : w
      )
    );
    setRecentChanges((prev) => [
      {
        id: "c_" + Date.now(),
        watchId: target.id,
        title: target.name,
        note: "Checked just now — no changes detected",
        summary: "Manual check complete — page quiet",
        time: "Just now",
        dotColor: "green",
        noisyBitsSkipped: 0,
      },
      ...prev,
    ]);
    setChecksCompleted((prev) => prev + 1);
    setActiveMenuWatchId(null);
    showToast(`Checked "${target.name}" — verified, no new changes!`, "success");
  };

  const openDiffInspector = (watchId: string) => {
    setActiveDiffWatchId(watchId);
    setActiveTab("diff");
    setActiveMenuWatchId(null);
  };

  const openLogbook = (pub: PublicWatch) => {
    setActiveLogbookWatch(pub);
    setActiveTab("logbook");
  };

  /* Settings Actions */
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileNameInput.trim()) return;
    updateUserProfile({ fullName: profileNameInput.trim(), email: profileEmailInput.trim() });
    setIsEditProfileOpen(false);
    showToast("Profile updated successfully!", "success");
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    if (!currPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    setCurrPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setIsChangePasswordOpen(false);
    showToast("Your password has been changed successfully!", "success");
  };

  const handleToggle2FA = () => {
    if (is2FAEnabled) {
      setIs2FAEnabled(false);
      localStorage.setItem("checkon_2fa_enabled", "false");
      showToast("Two-factor authentication disabled.", "info");
    } else {
      setIs2FAModalOpen(true);
    }
  };

  const handleConfirm2FA = (e: React.FormEvent) => {
    e.preventDefault();
    if (twoFactorCode.trim().length !== 6) {
      showToast("Please enter the 6-digit verification code.", "error");
      return;
    }
    setIs2FAEnabled(true);
    localStorage.setItem("checkon_2fa_enabled", "true");
    setTwoFactorCode("");
    setIs2FAModalOpen(false);
    showToast("Two-factor authentication enabled successfully! 🛡️", "success");
  };

  const handleExportData = () => {
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user?.id,
        fullName: user?.fullName,
        email: user?.email,
        plan: userPlan,
      },
      stats: {
        totalWatches: watches.length,
        totalChecksCompleted: checksCompleted,
        activeFollows: Object.keys(followedIds).filter((k) => followedIds[k]).length,
      },
      watches,
      recentChanges,
      notificationSettings: {
        emailAlerts: notifEmailAlerts,
        weeklyDigest: notifWeeklyDigest,
        pushNotifications: notifPush,
        noiseFiltering: notifNoiseFiltering,
        digestFrequency,
        digestDeliveryTime,
      },
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `checkon-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Downloaded all your watches & changes as JSON!", "success");
  };

  const handleSignoutDevice = (deviceId: string, deviceName: string) => {
    setConnectedDevices((prev) => prev.filter((d) => d.id !== deviceId));
    showToast(`Signed out device "${deviceName}".`, "info");
  };

  const handleDeleteAllWatches = () => {
    setWatches([]);
    setRecentChanges([]);
    setIsDeleteAllConfirmOpen(false);
    showToast("All active watches have been permanently deleted.", "info");
  };

  const handleDeleteAccount = () => {
    if (deleteConfirmText.trim().toUpperCase() !== "DELETE") {
      showToast("Please type 'DELETE' to confirm account deletion.", "error");
      return;
    }
    try {
      localStorage.clear();
    } catch { /* ignore */ }
    setIsDeleteAccountConfirmOpen(false);
    void logout();
  };

  const handleLogbookSubscribe = (e: React.FormEvent, pubId: string, pubTitle: string) => {
    e.preventDefault();
    if (!logbookEmail || !logbookEmail.includes("@")) {
      showToast("Please enter a valid email address.", "error");
      return;
    }
    const next = { ...subscribedWatches, [pubId]: true };
    setSubscribedWatches(next);
    try {
      localStorage.setItem("checkon_subscribed_watches", JSON.stringify(next));
    } catch { /* ignore */ }
    showToast(`Subscribed! Real change alerts for "${pubTitle}" will be sent to ${logbookEmail}.`, "success");
  };

  const handleLogbookUnsubscribe = (pubId: string, pubTitle: string) => {
    const next = { ...subscribedWatches, [pubId]: false };
    setSubscribedWatches(next);
    try {
      localStorage.setItem("checkon_subscribed_watches", JSON.stringify(next));
    } catch { /* ignore */ }
    showToast(`Unsubscribed from "${pubTitle}".`, "info");
  };

  const handleCopyRSS = (pubTitle: string) => {
    const slug = pubTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const rssUrl = `https://checkon.app/feed/w/${slug}.xml`;
    void navigator.clipboard.writeText(rssUrl);
    showToast("RSS feed URL copied to clipboard! 📋", "success");
  };

  const handleDownloadJSONLogbook = (pub: PublicWatch) => {
    const payload = {
      watch: pub,
      generatedAt: new Date().toISOString(),
      entries: demoLogbookEntries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `checkon-${pub.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-logbook.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Downloaded public logbook JSON feed!", "success");
  };

  const handleClearNotifications = () => {
    setRecentChanges([]);
    showToast("Notifications cleared.", "info");
  };

  const fullName = user?.fullName || "Watcher";
  const firstName = user?.fullName ? user.fullName.split(" ")[0] : "there";
  const userInitials =
    user?.fullName
      ?.split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase() || "CO";

  /* Sparkline Component */
  const Sparkline = ({ data }: { data: number[] }) => {
    const bars = data || Array(24).fill(1);
    return (
      <div className="sparkline-container">
        {bars.map((v, i) => (
          <div key={i} className={`sparkline-bar ${v === 0 ? "empty" : v === 1 ? "quiet" : v === 2 ? "changed" : "error"}`} />
        ))}
      </div>
    );
  };

  const StatusDot = ({ status }: { status: WatchItem["status"] }) => (
    <span
      className={`ledger-status-dot ${
        status === "no-change" ? "green" : status === "change-detected" ? "amber" : status === "needs-look" ? "red" : "gray"
      }`}
    />
  );

  /* ====================================================================
     1. HOME VIEW
     ==================================================================== */
  const renderHomeView = () => (
    <>
      <div className="dashboard-hero-row">
        <div className="hero-left-text">
          <p className="hero-context-text">since your last visit ({lastVisit})...</p>
          <div className="hero-heading-wrap">
            <img
              src="/assets/dashboard-heading.png"
              alt="Everything you're waiting on."
              className="dashboard-heading-img"
            />
          </div>
          <p className="hero-subtext">We check the web, so you don't have to. Get notified only when it matters.</p>
        </div>
        <div className="hero-right-cta">
          <div className="hero-cta-button-wrap">
            <img src="/assets/auth-corner-burst.png" alt="" className="btn-corner-burst-doodle" aria-hidden="true" />
            <button type="button" className="btn-add-watch-primary" onClick={() => setIsAddModalOpen(true)}>
              <Plus size={18} strokeWidth={2.5} />
              <span>New watch</span>
            </button>
          </div>
        </div>
      </div>

      {recentChanges.length > 0 && (
        <div className="changed-cards-scroll">
          {recentChanges.slice(0, 5).map((change) => (
            <div key={change.id} className="changed-card">
              <div className="changed-card-accent" />
              <div className="changed-card-header">
                <span className={`changed-dot ${change.dotColor}`} />
                <span className="changed-card-name">{change.title}</span>
                <span className="changed-card-time">{change.time}</span>
              </div>
              <p className="changed-card-summary">{change.summary}</p>
              {change.noisyBitsSkipped > 0 && (
                <span className="changed-card-noise-badge">
                  {change.noisyBitsSkipped} noisy {change.noisyBitsSkipped === 1 ? "bit" : "bits"} skipped
                </span>
              )}
              <button
                type="button"
                className="changed-card-link"
                onClick={() => openDiffInspector(change.watchId || "w_sample")}
              >
                See the change <ArrowRight size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="ledger-toolbar">
        <div className="ledger-filter-tabs">
          {[
            { key: "everything", label: "Everything", count: watches.length },
            { key: "changed", label: "Changed", count: changedWatches.length },
            { key: "needs-look", label: "Needs a look", count: needsLookWatches.length },
            { key: "quiet", label: "Quiet", count: quietWatches.length },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`ledger-tab ${ledgerFilter === tab.key ? "active" : ""}`}
              onClick={() => setLedgerFilter(tab.key)}
            >
              {tab.label} <span className="tab-count">{tab.count}</span>
            </button>
          ))}
        </div>
        <div className="ledger-search-wrap">
          <Search size={14} className="ledger-search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            className="ledger-search-input"
            placeholder="Find a watch (/)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {filteredWatches.length === 0 ? (
        <div className="watches-empty-state">
          <div className="empty-icon-box">
            <Globe size={24} />
          </div>
          <h3 className="empty-title">No watches match this view</h3>
          <p className="empty-desc">
            {watches.length === 0
              ? "Track any public webpage for changes. Enter a URL and we'll monitor it automatically."
              : "Try changing your filter or search query to see other watches."}
          </p>
          <button type="button" className="btn-empty-add" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={16} />
            <span>Add a watch</span>
          </button>
        </div>
      ) : (
        <div className="watch-ledger">
          <div className="ledger-header-row">
            <span className="ledger-col-status" />
            <span className="ledger-col-watch">WATCH</span>
            <span className="ledger-col-tellme">TELL ME IF</span>
            <span className="ledger-col-checks">LAST 24 CHECKS</span>
            <span className="ledger-col-checked">CHECKED</span>
            <span className="ledger-col-every">EVERY</span>
            <span className="ledger-col-actions" />
          </div>
          {filteredWatches.map((watch) => (
            <div key={watch.id} className={`ledger-row ${watch.status === "change-detected" ? "row-changed" : ""}`}>
              <span className="ledger-col-status">
                <StatusDot status={watch.status} />
              </span>
              <div className="ledger-col-watch">
                <div className="ledger-watch-info">
                  <h4
                    className="ledger-watch-name clickable"
                    onClick={() => openDiffInspector(watch.id)}
                    title="Click to view diff"
                  >
                    {watch.name}
                  </h4>
                  <a
                    href={watch.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ledger-watch-url"
                  >
                    {watch.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                </div>
              </div>
              <span className="ledger-col-tellme">
                <span className="tellme-text">{watch.tellMeIf}</span>
              </span>
              <span className="ledger-col-checks">
                <Sparkline data={watch.checksLast24h} />
              </span>
              <span className="ledger-col-checked">
                <span className="checked-time">{watch.lastChecked}</span>
              </span>
              <span className="ledger-col-every">
                <span className="every-badge">{watch.checkEvery}</span>
              </span>
              <span className="ledger-col-actions">
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    className="watch-more-btn"
                    onClick={() => setActiveMenuWatchId(activeMenuWatchId === watch.id ? null : watch.id)}
                    aria-label="Watch actions"
                  >
                    <MoreVertical size={16} />
                  </button>
                  {activeMenuWatchId === watch.id && (
                    <div className="user-menu-dropdown" style={{ right: 0, top: "100%", width: 175 }}>
                      <button type="button" className="user-menu-item" onClick={() => openDiffInspector(watch.id)}>
                        <Eye size={14} />
                        <span>See changes</span>
                      </button>
                      <button type="button" className="user-menu-item" onClick={() => handleCheckNow(watch.id)}>
                        <RefreshCw size={14} />
                        <span>Check now</span>
                      </button>
                      <button type="button" className="user-menu-item" onClick={() => handleEditWatchOpen(watch)}>
                        <Edit3 size={14} />
                        <span>Edit watch</span>
                      </button>
                      <a href={watch.url} target="_blank" rel="noopener noreferrer" className="user-menu-item">
                        <ExternalLink size={14} />
                        <span>Visit page</span>
                      </a>
                      <button
                        type="button"
                        className="user-menu-item logout"
                        onClick={() => handleDeleteWatch(watch.id)}
                      >
                        <Trash2 size={14} />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </span>
            </div>
          ))}
          <button type="button" className="add-another-watch-row" onClick={() => setIsAddModalOpen(true)}>
            <div className="add-row-left">
              <div className="add-plus-icon-box">
                <Plus size={18} />
              </div>
              <div>
                <div className="add-row-title">Add another watch</div>
                <div className="add-row-subtitle">Track any public page</div>
              </div>
            </div>
            <ArrowRight size={18} color="#6B7280" />
          </button>
        </div>
      )}

      <div className="dash-card-box" style={{ marginTop: 8 }}>
        <div className="dash-card-header">
          <h2 className="dash-card-title">Popular Public Watches</h2>
          <span className="dash-card-subtitle">Follow any — they'll appear in your ledger</span>
        </div>
        <div className="public-watches-list">
          {publicWatches.map((pub) => {
            const isFollowed = !!followedIds[pub.id];
            return (
              <div key={pub.id} className="public-watch-row">
                <div className="public-watch-left">
                  <div className="public-watch-icon">
                    {pub.iconType === "gov" ? (
                      <Landmark size={18} />
                    ) : pub.iconType === "visa" ? (
                      <Calendar size={18} />
                    ) : (
                      <FileText size={18} />
                    )}
                  </div>
                  <div>
                    <h4 className="public-watch-title clickable" onClick={() => openLogbook(pub)}>
                      {pub.title}
                    </h4>
                    <p className="public-watch-followers">{pub.followers}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className={`btn-follow-toggle ${isFollowed ? "following" : ""}`}
                  onClick={() => handleToggleFollow(pub.id)}
                >
                  {isFollowed ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Check size={12} /> Following
                    </span>
                  ) : (
                    "Follow"
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="dash-bottom-banner">
        <img src="/assets/bottom-banner-doodle.png" alt="Stop checking. Start knowing." className="bottom-banner-doodle-img" />
        <p className="banner-desc-text">Let CheckOn monitor the web for you and notify you only when it matters.</p>
        <button type="button" className="btn-banner-add" onClick={() => setIsAddModalOpen(true)}>
          <span>Add a Watch</span>
          <ArrowRight size={15} />
        </button>
      </div>
    </>
  );

  /* ====================================================================
     2. DIFF INSPECTOR VIEW
     ==================================================================== */
  const renderDiffInspector = () => {
    const watch = watches.find((w) => w.id === activeDiffWatchId);
    const watchName = watch?.name || "UPSC notifications";
    const totalNoise = demoSkippedItems.reduce((sum, s) => sum + s.count, 0);
    const realChanges = demoDiffLines.filter((l) => l.type === "added").length;

    /* Filter lines based on active view tab & skipped item filter */
    const displayedLines = demoDiffLines.filter((line) => {
      if (activeSkippedFilter) {
        return line.noiseCategory === activeSkippedFilter || line.type === "added";
      }
      if (diffViewTab === "mattered") {
        return line.type === "added";
      }
      if (diffViewTab === "skipped") {
        return line.type === "noise";
      }
      return true;
    });

    return (
      <div className="diff-inspector">
        <div className="diff-breadcrumb">
          <button type="button" className="diff-back-btn" onClick={() => setActiveTab("home")}>
            <ArrowLeft size={16} />
          </button>
          <span className="breadcrumb-logo">CheckOn</span>
          <ChevronRight size={14} className="breadcrumb-sep" />
          <span className="breadcrumb-link" onClick={() => setActiveTab("home")}>
            My watches
          </span>
          <ChevronRight size={14} className="breadcrumb-sep" />
          <span className="breadcrumb-current">{watchName}</span>
        </div>

        <div className="diff-hero">
          <div className="diff-hero-left">
            <h1 className="diff-headline">
              <span className="diff-highlight">
                {realChanges} {realChanges === 1 ? "change was" : "changes"} worth telling.
              </span>{" "}
              <span className="diff-muted">{totalNoise} weren't.</span>
            </h1>
            <p className="diff-meta">
              {watch?.url?.replace(/^https?:\/\//, "") || "upsc.gov.in/whats-new"} &middot; 17 Sep 2026, 09:30:12 &rarr; 09:40:07 IST
            </p>
          </div>
          <div className="diff-stamp">
            <span className="worth-telling-badge">WORTH TELLING</span>
          </div>
        </div>

        <div className="diff-filter-bar">
          <div className="diff-view-tabs">
            <button
              type="button"
              className={`diff-view-tab ${diffViewTab === "all" ? "active" : ""}`}
              onClick={() => {
                setDiffViewTab("all");
                setActiveSkippedFilter(null);
              }}
            >
              Whole page
            </button>
            <button
              type="button"
              className={`diff-view-tab ${diffViewTab === "mattered" ? "active" : ""}`}
              onClick={() => {
                setDiffViewTab("mattered");
                setActiveSkippedFilter(null);
              }}
            >
              What mattered
            </button>
            <button
              type="button"
              className={`diff-view-tab ${diffViewTab === "skipped" ? "active" : ""}`}
              onClick={() => {
                setDiffViewTab("skipped");
                setActiveSkippedFilter(null);
              }}
            >
              What we skipped
            </button>
          </div>
          <button
            type="button"
            className={`diff-margin-toggle ${showMarginNotes ? "active" : ""}`}
            onClick={() => setShowMarginNotes(!showMarginNotes)}
            title="Toggle margin notes visibility"
          >
            <Filter size={14} />
            <span>margin notes {showMarginNotes ? "(on)" : "(off)"}</span>
          </button>
        </div>

        <div className="diff-content-grid">
          <div className="diff-ruled-panel">
            <div className="diff-legend">
              <span className="legend-item">
                <span className="legend-dot highlighted" /> highlighted = mattered
              </span>
              <span className="legend-item">
                <span className="legend-dot struck" /> struck = ignored
              </span>
              {activeSkippedFilter && (
                <button
                  type="button"
                  style={{
                    marginLeft: "auto",
                    background: "#FEF3C7",
                    border: "1px solid #FCD34D",
                    borderRadius: 6,
                    padding: "2px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  onClick={() => setActiveSkippedFilter(null)}
                >
                  Filtering: {activeSkippedFilter} &times;
                </button>
              )}
            </div>
            {displayedLines.map((line) => {
              const isFilteredNoise = activeSkippedFilter && line.noiseCategory === activeSkippedFilter;
              return (
                <div
                  key={line.lineNum}
                  className={`diff-line ${line.type} ${isFilteredNoise ? "highlighted-filter" : ""}`}
                >
                  <span className="diff-line-num">{line.lineNum}</span>
                  <span className={`diff-line-content ${line.type}`}>
                    {line.type === "noise" ? (
                      <s>{line.content}</s>
                    ) : line.type === "added" ? (
                      <mark className="diff-highlight-mark">{line.content}</mark>
                    ) : (
                      line.content
                    )}
                  </span>
                  {showMarginNotes && line.annotation && (
                    <span className={`diff-annotation ${line.type === "added" ? "highlight" : "noise"}`}>
                      &larr; {line.annotation}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="diff-sidebar">
            <div className="diff-sidebar-card why-mattered">
              <h3 className="diff-card-heading">Why this mattered</h3>
              <p className="diff-card-body">
                You asked to hear when <strong>&ldquo;the CSE 2026 final result is posted&rdquo;</strong>
              </p>
              <p className="diff-card-detail">
                Line 6 is new and mentions &ldquo;Final Result&rdquo; and &ldquo;Civil Services Examination, 2026&rdquo;.
              </p>
            </div>
            <div className="diff-sidebar-card what-skipped">
              <div className="diff-card-header-row">
                <h3 className="diff-card-heading">What we skipped</h3>
                <span className="diff-card-hint">tap one to trace it</span>
              </div>
              {demoSkippedItems.map((item) => {
                const isActive = activeSkippedFilter === item.category;
                return (
                  <div
                    key={item.label}
                    className={`skipped-item-row clickable ${isActive ? "active" : ""}`}
                    onClick={() => {
                      if (isActive) {
                        setActiveSkippedFilter(null);
                      } else {
                        setActiveSkippedFilter(item.category);
                        showToast(`Filtering diff to trace: ${item.label}`, "info");
                      }
                    }}
                  >
                    <div className="skipped-check-icon">
                      <CheckCircle2 size={16} />
                    </div>
                    <div className="skipped-info">
                      <span className="skipped-label">{item.label}</span>
                    </div>
                    <span className="skipped-count">&times;{item.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ====================================================================
     3. PUBLIC WATCH LOGBOOK VIEW
     ==================================================================== */
  const renderLogbook = () => {
    const pub = activeLogbookWatch || publicWatches[0];
    const isSubscribed = !!subscribedWatches[pub.id];

    return (
      <div className="logbook-view">
        <div className="diff-breadcrumb">
          <button type="button" className="diff-back-btn" onClick={() => setActiveTab("home")}>
            <ArrowLeft size={16} />
          </button>
          <span className="breadcrumb-logo">CheckOn</span>
          <ChevronRight size={14} className="breadcrumb-sep" />
          <span className="breadcrumb-current">/w/{pub.title.toLowerCase().replace(/\s+/g, "-")}</span>
        </div>

        <div className="logbook-content-grid">
          <div className="logbook-left">
            <div className="logbook-header">
              <div className="logbook-status-line">
                <span className="logbook-live-dot" />
                <span className="logbook-status-text">public watch, last checked 4 minutes ago</span>
              </div>
              <h1 className="logbook-title">{pub.title}</h1>
              <p className="logbook-description">{pub.description}</p>
              <div className="logbook-meta-row">
                <span className="logbook-meta-item">{pub.url.replace(/^https?:\/\//, "")}</span>
                <span className="logbook-meta-sep">&middot;</span>
                <span className="logbook-meta-item">{pub.checkEvery}</span>
                <span className="logbook-meta-sep">&middot;</span>
                <span className="logbook-meta-item">{pub.since}</span>
              </div>
            </div>

            <div className="logbook-timeline-section">
              <div className="logbook-timeline-header">
                <h2 className="logbook-section-title">The logbook</h2>
                <span className="logbook-section-hint">every change, plus every quiet stretch</span>
              </div>
              <div className="logbook-timeline">
                {demoLogbookEntries.map((entry) => (
                  <div key={entry.id} className={`logbook-entry ${entry.type}`}>
                    {entry.type === "change" ? (
                      <>
                        <div className="logbook-entry-left">
                          <span className="logbook-entry-date">{entry.date}</span>
                          <span className="logbook-entry-time">{entry.time}</span>
                        </div>
                        <div className="logbook-entry-dot-col">
                          <span className={`logbook-entry-dot ${entry.isLatest ? "latest" : ""}`} />
                          <span className="logbook-entry-line" />
                        </div>
                        <div className="logbook-entry-content">
                          {entry.isLatest && <span className="logbook-latest-badge">latest &darr;</span>}
                          <h3 className="logbook-entry-title">{entry.title}</h3>
                          <p className="logbook-entry-desc">{entry.description}</p>
                          <div className="logbook-entry-actions">
                            <button
                              type="button"
                              className="logbook-see-change"
                              onClick={() => {
                                setActiveDiffWatchId(pub.id);
                                setActiveTab("diff");
                              }}
                            >
                              See the change
                            </button>
                            {(entry.noisyBitsSkipped ?? 0) > 0 && (
                              <span className="logbook-noise-badge">
                                {entry.noisyBitsSkipped} noisy {entry.noisyBitsSkipped === 1 ? "bit" : "bits"} skipped
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="logbook-entry-left" />
                        <div className="logbook-entry-dot-col">
                          <span className="logbook-entry-line" />
                        </div>
                        <div className="logbook-quiet-stretch">
                          <span className="quiet-tally">
                            {"||||".repeat(Math.min(5, Math.floor((entry.quietChecks || 0) / 200)))}
                          </span>
                          <span className="quiet-text">
                            {entry.quietChecks?.toLocaleString()} quiet checks over {entry.quietDays} days
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="logbook-right">
            <div className="subscribe-card">
              <h3 className="subscribe-heading">Get told when it changes</h3>
              <p className="subscribe-desc">One email per real change. No account needed. One-click unsubscribe.</p>

              {isSubscribed ? (
                <div className="subscribe-success-box">
                  <div className="subscribe-success-header">
                    <CheckCircle size={16} />
                    <span>Subscribed!</span>
                  </div>
                  <p>You'll receive real change alerts for this watch.</p>
                  <button
                    type="button"
                    className="btn-unsubscribe-text"
                    onClick={() => handleLogbookUnsubscribe(pub.id, pub.title)}
                  >
                    Unsubscribe
                  </button>
                </div>
              ) : (
                <form onSubmit={(e) => handleLogbookSubscribe(e, pub.id, pub.title)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <label className="subscribe-label">your email</label>
                  <input
                    type="email"
                    className="subscribe-input"
                    placeholder="you@example.com"
                    value={logbookEmail}
                    onChange={(e) => setLogbookEmail(e.target.value)}
                    required
                  />
                  <button type="submit" className="subscribe-btn">
                    Subscribe
                  </button>
                </form>
              )}

              <div className="subscribe-stats">
                <div className="subscribe-stat">
                  <span className="subscribe-stat-num">{pub.followers.split(" ")[0]}</span>
                  <span className="subscribe-stat-label">people following</span>
                </div>
              </div>
              <div className="subscribe-exports">
                also as{" "}
                <button type="button" className="subscribe-export-link" onClick={() => handleCopyRSS(pub.title)}>
                  RSS
                </button>{" "}
                &middot;{" "}
                <button type="button" className="subscribe-export-link" onClick={() => handleDownloadJSONLogbook(pub)}>
                  JSON
                </button>{" "}
                &middot;{" "}
                <button type="button" className="subscribe-export-link" onClick={() => setIsEmbedModalOpen(true)}>
                  embed
                </button>
              </div>
            </div>
            <button
              type="button"
              className="btn-add-watch-primary"
              style={{ marginTop: 16, width: "100%" }}
              onClick={() => setIsAddModalOpen(true)}
            >
              Watch your own page
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ====================================================================
     4. FOLLOWING VIEW
     ==================================================================== */
  const renderFollowingView = () => {
    const followedPubs = publicWatches.filter((p) => !!followedIds[p.id]);
    return (
      <div className="following-view">
        <div className="following-header">
          <h1 className="following-title">Following</h1>
          <p className="following-subtitle">Public watches you're subscribed to. Every real change lands in your feed.</p>
        </div>

        {followedPubs.length === 0 ? (
          <div className="watches-empty-state">
            <div className="empty-icon-box">
              <Users size={24} />
            </div>
            <h3 className="empty-title">Not following anyone yet</h3>
            <p className="empty-desc">
              Browse popular public watches below and hit Follow to get updates whenever they detect real changes.
            </p>
            <button type="button" className="btn-empty-add" onClick={() => setActiveTab("home")}>
              <Globe size={16} />
              <span>Browse public watches</span>
            </button>
          </div>
        ) : (
          <div className="following-grid">
            {followedPubs.map((pub) => (
              <div key={pub.id} className="following-card">
                <div className="following-card-top">
                  <div className="following-card-icon">
                    {pub.iconType === "gov" ? (
                      <Landmark size={20} />
                    ) : pub.iconType === "visa" ? (
                      <Calendar size={20} />
                    ) : (
                      <FileText size={20} />
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-follow-toggle following"
                    onClick={() => handleToggleFollow(pub.id)}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Check size={12} /> Following
                    </span>
                  </button>
                </div>
                <h3 className="following-card-title" onClick={() => openLogbook(pub)}>
                  {pub.title}
                </h3>
                <p className="following-card-desc">{pub.description}</p>
                <div className="following-card-meta">
                  <span>{pub.followers}</span>
                  <span className="logbook-meta-sep">&middot;</span>
                  <span>{pub.checkEvery}</span>
                  <span className="logbook-meta-sep">&middot;</span>
                  <span>{pub.since}</span>
                </div>
                <button type="button" className="following-card-link" onClick={() => openLogbook(pub)}>
                  View logbook <ArrowRight size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Discover more */}
        <div className="dash-card-box" style={{ marginTop: 16 }}>
          <div className="dash-card-header">
            <h2 className="dash-card-title">Discover more</h2>
            <span className="dash-card-subtitle">Popular watches you're not following yet</span>
          </div>
          <div className="public-watches-list">
            {publicWatches.filter((p) => !followedIds[p.id]).map((pub) => (
              <div key={pub.id} className="public-watch-row">
                <div className="public-watch-left">
                  <div className="public-watch-icon">
                    {pub.iconType === "gov" ? (
                      <Landmark size={18} />
                    ) : pub.iconType === "visa" ? (
                      <Calendar size={18} />
                    ) : (
                      <FileText size={18} />
                    )}
                  </div>
                  <div>
                    <h4 className="public-watch-title clickable" onClick={() => openLogbook(pub)}>
                      {pub.title}
                    </h4>
                    <p className="public-watch-followers">{pub.followers}</p>
                  </div>
                </div>
                <button type="button" className="btn-follow-toggle" onClick={() => handleToggleFollow(pub.id)}>
                  Follow
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /* ====================================================================
     5. WEEKLY DIGEST VIEW
     ==================================================================== */
  const renderDigestView = () => {
    const nextSunday = new Date();
    nextSunday.setDate(nextSunday.getDate() + (7 - nextSunday.getDay()));
    const nextDateStr = `${nextSunday.getDate()} ${nextSunday.toLocaleString("en", { month: "short" })} ${nextSunday.getFullYear()}`;

    return (
      <div className="digest-view">
        <div className="digest-header">
          <div className="digest-icon-wrap">
            <Mail size={24} />
          </div>
          <div>
            <h1 className="digest-title">Weekly Digest</h1>
            <p className="digest-subtitle">
              Every Sunday at {digestDeliveryTime} IST, we send a summary of everything that happened across your watches.
            </p>
          </div>
        </div>

        <div className="digest-layout-grid">
          <div className="digest-left-col">
            {/* Next digest card */}
            <div className="digest-next-card">
          <div className="digest-next-header">
            <span className="digest-next-label">NEXT DIGEST</span>
            <span className="digest-next-date">
              {nextDateStr} &middot; {digestDeliveryTime} IST
            </span>
          </div>
          <div className="digest-preview-email">
            <div className="digest-email-header">
              <img src="/assets/logo.png" alt="CheckOn" style={{ height: 24 }} />
              <span className="digest-email-date">Week of {nextDateStr}</span>
            </div>
            <h2 className="digest-email-subject">
              {digestFrequency === "off" ? "Digest is currently paused" : "Your weekly CheckOn digest"}
            </h2>

            <div className="digest-section">
              <h3 className="digest-section-title">
                <span className="digest-section-icon changed" /> Changes detected
              </h3>
              {recentChanges.length > 0 ? (
                recentChanges.slice(0, 3).map((c) => (
                  <div key={c.id} className="digest-item">
                    <span className={`changed-dot ${c.dotColor}`} />
                    <div className="digest-item-info">
                      <span className="digest-item-title">{c.title}</span>
                      <span className="digest-item-note">{c.summary}</span>
                    </div>
                    <span className="digest-item-time">{c.time}</span>
                  </div>
                ))
              ) : (
                <p className="digest-empty-note">No changes detected this week. Everything stayed quiet.</p>
              )}
            </div>

            {includeQuietWatches && (
              <div className="digest-section">
                <h3 className="digest-section-title">
                  <span className="digest-section-icon quiet" /> Quiet watches
                </h3>
                {watches.filter((w) => w.status === "no-change").length > 0 ? (
                  watches
                    .filter((w) => w.status === "no-change")
                    .slice(0, 3)
                    .map((w) => (
                      <div key={w.id} className="digest-item">
                        <span className="ledger-status-dot green" />
                        <div className="digest-item-info">
                          <span className="digest-item-title">{w.name}</span>
                          <span className="digest-item-note">No changes &middot; Last checked {w.lastChecked}</span>
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="digest-empty-note">No quiet watches to report.</p>
                )}
              </div>
            )}

            <div className="digest-email-footer">
              <p>
                You're receiving this because you have {watches.length} active watch{watches.length !== 1 ? "es" : ""} on CheckOn.
              </p>
              <p className="digest-email-unsub">
                <button
                  type="button"
                  style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", textDecoration: "underline", padding: 0 }}
                  onClick={() => {
                    setDigestFrequency("off");
                    localStorage.setItem("checkon_digest_freq", "off");
                    showToast("Unsubscribed from digests.", "info");
                  }}
                >
                  Unsubscribe from digests
                </button>{" "}
                &middot;{" "}
                <button
                  type="button"
                  style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", textDecoration: "underline", padding: 0 }}
                  onClick={() => setActiveTab("settings")}
                >
                  Manage notification preferences
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* Digest settings */}
        <div className="dash-card-box">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Digest preferences</h2>
          </div>
          <div className="digest-prefs">
            <div className="digest-pref-row">
              <div className="digest-pref-info">
                <span className="digest-pref-label">Frequency</span>
                <span className="digest-pref-value">
                  {digestFrequency === "daily"
                    ? "Daily summary"
                    : digestFrequency === "weekly"
                    ? "Weekly (every Sunday)"
                    : digestFrequency === "biweekly"
                    ? "Bi-weekly"
                    : "Off (paused)"}
                </span>
              </div>
              <select
                className="form-select"
                value={digestFrequency}
                onChange={(e) => {
                  setDigestFrequency(e.target.value);
                  localStorage.setItem("checkon_digest_freq", e.target.value);
                  showToast(`Digest frequency updated to ${e.target.value}!`, "success");
                }}
                style={{ width: 160 }}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="off">Off</option>
              </select>
            </div>
            <div className="digest-pref-row">
              <div className="digest-pref-info">
                <span className="digest-pref-label">Delivery time</span>
                <span className="digest-pref-value">{digestDeliveryTime} IST</span>
              </div>
              <select
                className="form-select"
                value={digestDeliveryTime}
                onChange={(e) => {
                  setDigestDeliveryTime(e.target.value);
                  localStorage.setItem("checkon_digest_time", e.target.value);
                  showToast(`Delivery time updated to ${e.target.value} IST!`, "success");
                }}
                style={{ width: 160 }}
              >
                <option value="06:00">06:00</option>
                <option value="08:00">08:00</option>
                <option value="10:00">10:00</option>
                <option value="18:00">18:00</option>
              </select>
            </div>
            <div className="digest-pref-row">
              <div className="digest-pref-info">
                <span className="digest-pref-label">Include quiet watches</span>
                <span className="digest-pref-value">
                  {includeQuietWatches ? "Showing watches with no changes" : "Skipping quiet watches"}
                </span>
              </div>
              <label className="digest-toggle">
                <input
                  type="checkbox"
                  checked={includeQuietWatches}
                  onChange={(e) => {
                    setIncludeQuietWatches(e.target.checked);
                    localStorage.setItem("checkon_digest_quiet", String(e.target.checked));
                    showToast(
                      e.target.checked ? "Quiet watches will be included in digest." : "Quiet watches will be excluded.",
                      "info"
                    );
                  }}
                />
                <span className="digest-toggle-slider" />
              </label>
            </div>
          </div>
        </div>
      </div>

      <aside className="digest-right-col">
        <div className="digest-doodle-wrap">
          <img
            src="/assets/weekly-digest-doodle.png"
            alt="Small changes make a big difference"
            className="digest-side-doodle-img"
          />
        </div>
      </aside>
    </div>
  </div>
);
  };

  /* ====================================================================
     6. SETTINGS VIEW
     ==================================================================== */
  const renderSettingsView = () => {
    return (
      <div className="settings-view">
        <div className="settings-header">
          <h1 className="settings-title">Settings</h1>
          <p className="settings-subtitle">Manage your account, notifications, and preferences.</p>
        </div>

        {/* Profile Section */}
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon">
              <Users size={18} />
            </div>
            <h2 className="settings-section-title">Profile</h2>
          </div>
          <div className="settings-card">
            <div className="settings-profile-row">
              <div className="settings-avatar">{userInitials}</div>
              <div className="settings-profile-info">
                <span className="settings-profile-name">{fullName}</span>
                <span className="settings-profile-email">{user?.email || "you@example.com"}</span>
              </div>
              <button
                type="button"
                className="settings-edit-btn"
                onClick={() => {
                  setProfileNameInput(user?.fullName || "");
                  setProfileEmailInput(user?.email || "");
                  setIsEditProfileOpen(true);
                }}
              >
                Edit profile
              </button>
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon">
              <Bell size={18} />
            </div>
            <h2 className="settings-section-title">Notifications</h2>
          </div>
          <div className="settings-card">
            <div className="settings-pref-row">
              <div className="settings-pref-info">
                <span className="settings-pref-label">Email alerts</span>
                <span className="settings-pref-desc">Get notified when a watched page changes</span>
              </div>
              <label className="digest-toggle">
                <input
                  type="checkbox"
                  checked={notifEmailAlerts}
                  onChange={(e) => {
                    setNotifEmailAlerts(e.target.checked);
                    localStorage.setItem("checkon_notif_email", String(e.target.checked));
                    showToast(e.target.checked ? "Email alerts enabled." : "Email alerts paused.", "info");
                  }}
                />
                <span className="digest-toggle-slider" />
              </label>
            </div>
            <div className="settings-pref-row">
              <div className="settings-pref-info">
                <span className="settings-pref-label">Weekly digest</span>
                <span className="settings-pref-desc">Summary of all watches every Sunday</span>
              </div>
              <label className="digest-toggle">
                <input
                  type="checkbox"
                  checked={notifWeeklyDigest}
                  onChange={(e) => {
                    setNotifWeeklyDigest(e.target.checked);
                    localStorage.setItem("checkon_notif_digest", String(e.target.checked));
                    showToast(e.target.checked ? "Weekly digest enabled." : "Weekly digest paused.", "info");
                  }}
                />
                <span className="digest-toggle-slider" />
              </label>
            </div>
            <div className="settings-pref-row">
              <div className="settings-pref-info">
                <span className="settings-pref-label">Push notifications</span>
                <span className="settings-pref-desc">Browser push for urgent changes</span>
              </div>
              <label className="digest-toggle">
                <input
                  type="checkbox"
                  checked={notifPush}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setNotifPush(next);
                    localStorage.setItem("checkon_notif_push", String(next));
                    if (next && "Notification" in window) {
                      void Notification.requestPermission();
                    }
                    showToast(next ? "Browser push notifications enabled." : "Push notifications turned off.", "info");
                  }}
                />
                <span className="digest-toggle-slider" />
              </label>
            </div>
            <div className="settings-pref-row">
              <div className="settings-pref-info">
                <span className="settings-pref-label">Noise filtering</span>
                <span className="settings-pref-desc">Skip timestamps, counters, and layout-only changes</span>
              </div>
              <label className="digest-toggle">
                <input
                  type="checkbox"
                  checked={notifNoiseFiltering}
                  onChange={(e) => {
                    setNotifNoiseFiltering(e.target.checked);
                    localStorage.setItem("checkon_notif_noise", String(e.target.checked));
                    showToast(
                      e.target.checked
                        ? "AI noise filtering is on. Skipping clocks & badges."
                        : "Noise filtering off. Showing raw html changes.",
                      "info"
                    );
                  }}
                />
                <span className="digest-toggle-slider" />
              </label>
            </div>
          </div>
        </div>

        {/* Connected Devices */}
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon">
              <Smartphone size={18} />
            </div>
            <h2 className="settings-section-title">Connected devices</h2>
          </div>
          <div className="settings-card">
            {connectedDevices.map((device) => (
              <div key={device.id} className="settings-device-row">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className={`settings-device-icon ${device.isCurrent ? "current" : ""}`}>
                    {device.type === "desktop" ? <Globe size={16} /> : <Smartphone size={16} />}
                  </div>
                  <div className="settings-device-info">
                    <span className="settings-device-name">
                      {device.name}{" "}
                      {device.isCurrent && <span className="settings-this-device">this device</span>}
                    </span>
                    <span className="settings-device-detail">Last active: {device.lastActive}</span>
                  </div>
                </div>
                {!device.isCurrent && (
                  <button
                    type="button"
                    className="btn-device-signout"
                    onClick={() => handleSignoutDevice(device.id, device.name)}
                  >
                    Sign out
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Security & Privacy */}
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon">
              <Shield size={18} />
            </div>
            <h2 className="settings-section-title">Security & Privacy</h2>
          </div>
          <div className="settings-card">
            <div className="settings-pref-row">
              <div className="settings-pref-info">
                <span className="settings-pref-label">Change password</span>
                <span className="settings-pref-desc">Update your account password</span>
              </div>
              <button
                type="button"
                className="settings-edit-btn"
                onClick={() => {
                  setPasswordError("");
                  setIsChangePasswordOpen(true);
                }}
              >
                Change
              </button>
            </div>
            <div className="settings-pref-row">
              <div className="settings-pref-info">
                <span className="settings-pref-label">
                  Two-factor authentication
                  <span className={`security-status-badge ${is2FAEnabled ? "enabled" : "disabled"}`}>
                    {is2FAEnabled ? "Active" : "Disabled"}
                  </span>
                </span>
                <span className="settings-pref-desc">
                  {is2FAEnabled ? "Protected with an authenticator app" : "Add an extra layer of security"}
                </span>
              </div>
              <button
                type="button"
                className="settings-edit-btn"
                onClick={handleToggle2FA}
              >
                {is2FAEnabled ? "Disable" : "Enable"}
              </button>
            </div>
            <div className="settings-pref-row">
              <div className="settings-pref-info">
                <span className="settings-pref-label">Export your data</span>
                <span className="settings-pref-desc">Download all your watches and changes as JSON</span>
              </div>
              <button type="button" className="settings-edit-btn" onClick={handleExportData}>
                <Download size={13} style={{ marginRight: 4 }} />
                Download
              </button>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon danger">
              <Trash2 size={18} />
            </div>
            <h2 className="settings-section-title danger">Danger zone</h2>
          </div>
          <div className="settings-card danger">
            <div className="settings-pref-row">
              <div className="settings-pref-info">
                <span className="settings-pref-label">Delete all watches</span>
                <span className="settings-pref-desc">This will permanently remove all your active watches</span>
              </div>
              <button
                type="button"
                className="settings-danger-btn"
                onClick={() => setIsDeleteAllConfirmOpen(true)}
              >
                Delete all
              </button>
            </div>
            <div className="settings-pref-row">
              <div className="settings-pref-info">
                <span className="settings-pref-label">Delete account</span>
                <span className="settings-pref-desc">Permanently delete your CheckOn account and all data</span>
              </div>
              <button
                type="button"
                className="settings-danger-btn"
                onClick={() => {
                  setDeleteConfirmText("");
                  setIsDeleteAccountConfirmOpen(true);
                }}
              >
                Delete account
              </button>
            </div>
          </div>
        </div>

        {/* Account info footer */}
        <div className="settings-footer">
          <span>CheckOn v1.0.0</span>
          <span className="logbook-meta-sep">&middot;</span>
          <span>
            {userPlan} Plan ({watches.length}/{maxWatchesQuota === 999 ? "∞" : maxWatchesQuota} watches)
          </span>
          <span className="logbook-meta-sep">&middot;</span>
          <span>Member since Sep 2026</span>
        </div>
      </div>
    );
  };

  /* ====================================================================
     MAIN RENDER
     ==================================================================== */
  return (
    <div className="checkon-dashboard-wrapper">
      <aside className="checkon-sidebar">
        <div className="sidebar-top">
          <a
            href="#"
            className="sidebar-brand"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab("home");
            }}
          >
            <img src="/assets/logo.png" alt="CheckOn" className="sidebar-logo-img" />
          </a>
          <nav className="sidebar-nav">
            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === "home" || activeTab === "diff" || activeTab === "logbook" ? "active" : ""}`}
              onClick={() => setActiveTab("home")}
            >
              <Home size={18} />
              <span>My watches</span>
              {watches.length > 0 && <span className="nav-badge">{watches.length}</span>}
            </button>
            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === "following" ? "active" : ""}`}
              onClick={() => setActiveTab("following")}
            >
              <Users size={18} />
              <span>Following</span>
              {Object.values(followedIds).filter(Boolean).length > 0 && (
                <span className="nav-badge">{Object.values(followedIds).filter(Boolean).length}</span>
              )}
            </button>
            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === "digest" ? "active" : ""}`}
              onClick={() => setActiveTab("digest")}
            >
              <Mail size={18} />
              <span>Weekly digest</span>
            </button>
            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              <Settings size={18} />
              <span>Settings</span>
            </button>
          </nav>
          <div className="sidebar-middle-doodle">
            <img
              src="/assets/sidebar-doodle.png"
              alt="Everything you're waiting on, in one place."
              className="sidebar-doodle-img"
            />
          </div>
          <div className="sidebar-digest-info">
            <img src="/assets/bottom-banner-doodle.png" alt="" className="sidebar-digest-icon" />
            <div>
              <span className="sidebar-digest-label">next digest</span>
              <span className="sidebar-digest-date">Sun 28 Sep &middot; {digestDeliveryTime}</span>
            </div>
          </div>
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-plan-card">
            <div className="plan-header">
              <div className="plan-icon-wrap">
                <Package size={16} />
              </div>
              <div className="plan-info">
                <span className="plan-title">{userPlan} Plan</span>
                <span className="plan-quota">
                  {watches.length}/{maxWatchesQuota === 999 ? "∞" : maxWatchesQuota} watches
                </span>
              </div>
            </div>
            <div className="plan-progress-track">
              <div
                className="plan-progress-fill"
                style={{ width: `${Math.min(100, (watches.length / maxWatchesQuota) * 100)}%` }}
              />
            </div>
            <button
              type="button"
              className="btn-plan-upgrade"
              onClick={() => setIsUpgradeModalOpen(true)}
            >
              {userPlan === "Free" ? "Upgrade" : "Manage Plan"}
            </button>
          </div>
        </div>
      </aside>

      <div className="checkon-main-area">
        <header className="dashboard-topbar">
          <div className="topbar-search-wrap">
            <Search size={16} className="topbar-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="topbar-search-input"
              placeholder="Search watches, URLs, or topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="topbar-search-shortcut">/</span>
          </div>
          <div className="topbar-actions">
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="topbar-bell-btn"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                title="Notifications"
                aria-label="View notifications"
              >
                <Bell size={19} />
                {recentChanges.length > 0 && <span className="bell-badge-dot" />}
              </button>
              {isNotificationsOpen && (
                <div className="user-menu-dropdown" style={{ right: 0, top: "calc(100% + 8px)", width: 310, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>Notifications</div>
                    {recentChanges.length > 0 && (
                      <button
                        type="button"
                        style={{ background: "none", border: "none", color: "#6B7280", fontSize: 11, cursor: "pointer" }}
                        onClick={handleClearNotifications}
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  {recentChanges.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#9CA3AF", padding: "16px 0", textAlign: "center" }}>
                      No new notifications
                    </div>
                  ) : (
                    recentChanges.slice(0, 4).map((c) => (
                      <div
                        key={c.id}
                        style={{
                          padding: "8px 0",
                          borderBottom: "1px solid #F3F4F6",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          setIsNotificationsOpen(false);
                          openDiffInspector(c.watchId || "w_sample");
                        }}
                      >
                        <div style={{ fontWeight: 600, color: "#111827" }}>{c.title}</div>
                        <div style={{ color: "#6B7280", fontSize: 11 }}>{c.note}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="topbar-user-wrap">
              <button
                type="button"
                className={`topbar-user-btn ${isUserMenuOpen ? "active" : ""}`}
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                aria-label="User profile menu"
              >
                <div className="user-avatar-circle">{userInitials}</div>
                <span className="user-display-name">{firstName}</span>
                <ChevronDown size={14} className="user-dropdown-chevron" />
              </button>
              {isUserMenuOpen && (
                <div className="user-menu-dropdown">
                  <div className="user-menu-header">
                    <div className="menu-user-name">{fullName}</div>
                    <div className="menu-user-email">{user?.email || ""}</div>
                  </div>
                  <button
                    type="button"
                    className="user-menu-item"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setActiveTab("settings");
                    }}
                  >
                    <Settings size={15} />
                    <span>Settings</span>
                  </button>
                  {onSwitchToLanding && (
                    <button
                      type="button"
                      className="user-menu-item"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onSwitchToLanding();
                      }}
                    >
                      <LayoutDashboard size={15} />
                      <span>View Landing Page</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="user-menu-item logout"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      void logout();
                    }}
                  >
                    <LogOut size={15} />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="dashboard-content-scroll">
          {activeTab === "home" && renderHomeView()}
          {activeTab === "diff" && renderDiffInspector()}
          {activeTab === "logbook" && renderLogbook()}
          {activeTab === "following" && renderFollowingView()}
          {activeTab === "digest" && renderDigestView()}
          {activeTab === "settings" && renderSettingsView()}
        </main>
      </div>

      {/* Floating Toast Notification Container */}
      {toasts.length > 0 && (
        <div className="checkon-toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`checkon-toast ${t.type}`}>
              <div className="checkon-toast-content">
                {t.type === "success" && <CheckCircle size={16} />}
                {t.type === "error" && <AlertTriangle size={16} />}
                {t.type === "info" && <Sparkles size={16} />}
                <span>{t.text}</span>
              </div>
              <button
                type="button"
                className="checkon-toast-close"
                onClick={() => removeToast(t.id)}
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 1. Modal: Add Watch */}
      {isAddModalOpen && (
        <div className="checkon-modal-overlay" onClick={() => setIsAddModalOpen(false)} role="dialog" aria-modal="true">
          <div className="checkon-modal-card" onClick={(e) => e.stopPropagation()}>
            <img src="/assets/auth-corner-burst.png" alt="" className="checkon-modal-corner-burst" aria-hidden="true" />
            <div className="modal-header">
              <h3 className="modal-title">Track a New Webpage</h3>
              <button type="button" className="modal-close-btn" onClick={() => setIsAddModalOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddWatchSubmit} className="modal-form">
              <div className="form-group">
                <label className="form-label">Webpage URL *</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://example.com/notices"
                  value={newWatchUrl}
                  onChange={(e) => setNewWatchUrl(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Friendly Name (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. UPSC Notifications"
                  value={newWatchName}
                  onChange={(e) => setNewWatchName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tell me if...</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. the CSE 2026 final result is posted"
                  value={newWatchTellMeIf}
                  onChange={(e) => setNewWatchTellMeIf(e.target.value)}
                />
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Check Frequency</label>
                  <select
                    className="form-select"
                    value={newWatchFrequency}
                    onChange={(e) => setNewWatchFrequency(e.target.value)}
                  >
                    <option value="5m">Every 5 minutes</option>
                    <option value="15m">Every 15 minutes</option>
                    <option value="1h">Every 1 hour</option>
                    <option value="24h">Daily (24h)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Notification Mode</label>
                  <select className="form-select" defaultValue="email">
                    <option value="email">Email Alert</option>
                    <option value="in-app">In-app only</option>
                    <option value="webhook">Webhook URL</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-modal-cancel" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-modal-submit">
                  Start Watching
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Edit Watch */}
      {isEditWatchModalOpen && editingWatch && (
        <div className="checkon-modal-overlay" onClick={() => setIsEditWatchModalOpen(false)} role="dialog" aria-modal="true">
          <div className="checkon-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Watch Settings</h3>
              <button type="button" className="modal-close-btn" onClick={() => setIsEditWatchModalOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditWatchSubmit} className="modal-form">
              <div className="form-group">
                <label className="form-label">Watch Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingWatch.name}
                  onChange={(e) => setEditingWatch({ ...editingWatch, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Monitored URL *</label>
                <input
                  type="url"
                  className="form-input"
                  value={editingWatch.url}
                  onChange={(e) => setEditingWatch({ ...editingWatch, url: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tell me if...</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingWatch.tellMeIf}
                  onChange={(e) => setEditingWatch({ ...editingWatch, tellMeIf: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Check Frequency</label>
                <select
                  className="form-select"
                  value={editingWatch.checkEvery}
                  onChange={(e) => setEditingWatch({ ...editingWatch, checkEvery: e.target.value })}
                >
                  <option value="5m">Every 5 minutes</option>
                  <option value="10m">Every 10 minutes</option>
                  <option value="15m">Every 15 minutes</option>
                  <option value="30m">Every 30 minutes</option>
                  <option value="1h">Every 1 hour</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-modal-cancel" onClick={() => setIsEditWatchModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-modal-submit">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal: Edit Profile */}
      {isEditProfileOpen && (
        <div className="checkon-modal-overlay" onClick={() => setIsEditProfileOpen(false)} role="dialog" aria-modal="true">
          <div className="checkon-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Profile</h3>
              <button type="button" className="modal-close-btn" onClick={() => setIsEditProfileOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveProfile} className="modal-form">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={profileNameInput}
                  onChange={(e) => setProfileNameInput(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  className="form-input"
                  value={profileEmailInput}
                  onChange={(e) => setProfileEmailInput(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Job Role / Bio</label>
                <input
                  type="text"
                  className="form-input"
                  value={profileRoleInput}
                  onChange={(e) => setProfileRoleInput(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-modal-cancel" onClick={() => setIsEditProfileOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-modal-submit">
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal: Change Password */}
      {isChangePasswordOpen && (
        <div className="checkon-modal-overlay" onClick={() => setIsChangePasswordOpen(false)} role="dialog" aria-modal="true">
          <div className="checkon-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Change Password</h3>
              <button type="button" className="modal-close-btn" onClick={() => setIsChangePasswordOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {passwordError && (
              <div className="danger-warning-callout" style={{ marginBottom: 12 }}>
                {passwordError}
              </div>
            )}
            <form onSubmit={handleChangePassword} className="modal-form">
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={currPassword}
                  onChange={(e) => setCurrPassword(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">New Password (min 6 characters)</label>
                <input
                  type="password"
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-modal-cancel" onClick={() => setIsChangePasswordOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-modal-submit">
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal: Two-Factor Authentication (2FA) */}
      {is2FAModalOpen && (
        <div className="checkon-modal-overlay" onClick={() => setIs2FAModalOpen(false)} role="dialog" aria-modal="true">
          <div className="checkon-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Set Up Two-Factor Authentication</h3>
              <button type="button" className="modal-close-btn" onClick={() => setIs2FAModalOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div style={{ textAlign: "center", margin: "10px 0 20px" }}>
              <div
                style={{
                  width: 130,
                  height: 130,
                  background: "#F9FAFB",
                  border: "2px dashed #D1D5DB",
                  borderRadius: 16,
                  margin: "0 auto 12px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Shield size={32} color="#059669" />
                <span style={{ fontSize: 11, color: "#6B7280" }}>Scan in Google Authenticator</span>
              </div>
              <div style={{ fontSize: 12, color: "#4B5563" }}>
                Secret key: <code style={{ background: "#F3F4F6", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>CKON-7892-XZPQ-4412</code>
              </div>
            </div>
            <form onSubmit={handleConfirm2FA} className="modal-form">
              <div className="form-group">
                <label className="form-label">Enter 6-digit Code</label>
                <input
                  type="text"
                  maxLength={6}
                  className="form-input"
                  placeholder="123456"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                  style={{ textAlign: "center", fontSize: 20, letterSpacing: 6, fontWeight: 700 }}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-modal-cancel" onClick={() => setIs2FAModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-modal-submit">
                  Verify & Enable
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal: Pro Upgrade Plan */}
      {isUpgradeModalOpen && (
        <div className="checkon-modal-overlay" onClick={() => setIsUpgradeModalOpen(false)} role="dialog" aria-modal="true">
          <div className="checkon-modal-card" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Upgrade Your CheckOn Plan</h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
                  Scale up monitoring frequency, active watches, and instant webhooks.
                </p>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setIsUpgradeModalOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="upgrade-modal-grid">
              {/* Free Tier */}
              <div className={`upgrade-tier-card ${userPlan === "Free" ? "current" : ""}`}>
                <div>
                  <h4 className="upgrade-tier-name">Free</h4>
                  <div className="upgrade-tier-price">$0 <span>/ month</span></div>
                  <ul className="upgrade-tier-features">
                    <li><Check size={14} color="#059669" /> Up to 5 active watches</li>
                    <li><Check size={14} color="#059669" /> 15-minute checks</li>
                    <li><Check size={14} color="#059669" /> Email alerts & digest</li>
                    <li><Check size={14} color="#059669" /> Noise filtering</li>
                  </ul>
                </div>
                <button
                  type="button"
                  className="btn-tier-select"
                  disabled={userPlan === "Free"}
                  onClick={() => {
                    setUserPlan("Free");
                    setIsUpgradeModalOpen(false);
                    showToast("Switched back to Free Plan.", "info");
                  }}
                >
                  {userPlan === "Free" ? "Current Plan" : "Downgrade"}
                </button>
              </div>

              {/* Pro Tier */}
              <div className={`upgrade-tier-card featured ${userPlan === "Pro" ? "current" : ""}`}>
                <span className="badge-popular">MOST POPULAR</span>
                <div>
                  <h4 className="upgrade-tier-name">Pro</h4>
                  <div className="upgrade-tier-price">$9 <span>/ month</span></div>
                  <ul className="upgrade-tier-features">
                    <li><Check size={14} color="#059669" /> <strong>Up to 50 watches</strong></li>
                    <li><Check size={14} color="#059669" /> <strong>1-minute checks</strong></li>
                    <li><Check size={14} color="#059669" /> SMS & WhatsApp alerts</li>
                    <li><Check size={14} color="#059669" /> Webhooks & JSON APIs</li>
                    <li><Check size={14} color="#059669" /> Priority queue</li>
                  </ul>
                </div>
                <button
                  type="button"
                  className="btn-tier-select primary"
                  disabled={userPlan === "Pro"}
                  onClick={() => {
                    setUserPlan("Pro");
                    setIsUpgradeModalOpen(false);
                    showToast("Upgraded to CheckOn Pro Plan! 🎉 Quota increased to 50 watches.", "success");
                  }}
                >
                  {userPlan === "Pro" ? "Current Plan" : "Upgrade to Pro"}
                </button>
              </div>

              {/* Team Tier */}
              <div className={`upgrade-tier-card ${userPlan === "Team" ? "current" : ""}`}>
                <div>
                  <h4 className="upgrade-tier-name">Team</h4>
                  <div className="upgrade-tier-price">$29 <span>/ month</span></div>
                  <ul className="upgrade-tier-features">
                    <li><Check size={14} color="#059669" /> <strong>Unlimited watches</strong></li>
                    <li><Check size={14} color="#059669" /> 30-second checks</li>
                    <li><Check size={14} color="#059669" /> Team member seats (10)</li>
                    <li><Check size={14} color="#059669" /> Dedicated proxy IPs</li>
                    <li><Check size={14} color="#059669" /> 24/7 Priority support</li>
                  </ul>
                </div>
                <button
                  type="button"
                  className="btn-tier-select"
                  disabled={userPlan === "Team"}
                  onClick={() => {
                    setUserPlan("Team");
                    setIsUpgradeModalOpen(false);
                    showToast("Upgraded to CheckOn Team Plan! 🚀 Unlimited watches unlocked.", "success");
                  }}
                >
                  {userPlan === "Team" ? "Current Plan" : "Upgrade to Team"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal: Embed Logbook Snippet */}
      {isEmbedModalOpen && (
        <div className="checkon-modal-overlay" onClick={() => setIsEmbedModalOpen(false)} role="dialog" aria-modal="true">
          <div className="checkon-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Embed Public Watch Logbook</h3>
              <button type="button" className="modal-close-btn" onClick={() => setIsEmbedModalOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: "#4B5563", marginBottom: 12 }}>
              Paste this iframe code into your website or blog to display live timeline updates.
            </p>
            <div className="code-snippet-box">
              {`<iframe src="https://checkon.app/embed/w/${(activeLogbookWatch || publicWatches[0]).title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}" width="100%" height="450" frameborder="0" style="border-radius:12px;border:1px solid #E5E7EB;"></iframe>`}
            </div>
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button type="button" className="btn-modal-cancel" onClick={() => setIsEmbedModalOpen(false)}>
                Close
              </button>
              <button
                type="button"
                className="btn-modal-submit"
                onClick={() => {
                  const code = `<iframe src="https://checkon.app/embed/w/${(activeLogbookWatch || publicWatches[0]).title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}" width="100%" height="450" frameborder="0" style="border-radius:12px;border:1px solid #E5E7EB;"></iframe>`;
                  void navigator.clipboard.writeText(code);
                  showToast("Embed iframe code copied to clipboard! 📋", "success");
                  setIsEmbedModalOpen(false);
                }}
              >
                <Copy size={15} style={{ marginRight: 6 }} />
                Copy Embed Code
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modal: Delete All Watches Confirmation */}
      {isDeleteAllConfirmOpen && (
        <div className="checkon-modal-overlay" onClick={() => setIsDeleteAllConfirmOpen(false)} role="dialog" aria-modal="true">
          <div className="checkon-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: "#DC2626" }}>Delete All Watches?</h3>
              <button type="button" className="modal-close-btn" onClick={() => setIsDeleteAllConfirmOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="danger-warning-callout">
              This action cannot be undone. All {watches.length} active watches, custom rules, and change histories will be permanently removed.
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-modal-cancel" onClick={() => setIsDeleteAllConfirmOpen(false)}>
                Cancel
              </button>
              <button type="button" className="settings-danger-btn" onClick={handleDeleteAllWatches}>
                Yes, Delete All Watches
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Modal: Delete Account Confirmation */}
      {isDeleteAccountConfirmOpen && (
        <div className="checkon-modal-overlay" onClick={() => setIsDeleteAccountConfirmOpen(false)} role="dialog" aria-modal="true">
          <div className="checkon-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: "#DC2626" }}>Permanently Delete Account?</h3>
              <button type="button" className="modal-close-btn" onClick={() => setIsDeleteAccountConfirmOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="danger-warning-callout">
              Warning: This will permanently delete your CheckOn profile, active sessions, watches, and notifications.
            </div>
            <p style={{ fontSize: 13, color: "#374151", marginBottom: 12 }}>
              Please type <strong>DELETE</strong> below to confirm:
            </p>
            <input
              type="text"
              className="form-input"
              placeholder="Type DELETE"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            <div className="modal-actions">
              <button type="button" className="btn-modal-cancel" onClick={() => setIsDeleteAccountConfirmOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="settings-danger-btn"
                disabled={deleteConfirmText.trim().toUpperCase() !== "DELETE"}
                onClick={handleDeleteAccount}
              >
                Permanently Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
