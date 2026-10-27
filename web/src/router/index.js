import { createRouter, createWebHistory } from 'vue-router';
import { useUserStore } from '@/stores/user';

const routes = [
  /* ---------------- C 端页面 ---------------- */
  { path: '/', name: 'home', component: () => import('@/views/HomeView.vue'), meta: { keepAlive: true } },
  { path: '/search', name: 'search', component: () => import('@/views/SearchView.vue') },
  { path: '/shows', name: 'shows', component: () => import('@/views/ShowListView.vue') },
  { path: '/show/:id', name: 'show-detail', component: () => import('@/views/ShowDetailView.vue') },
  { path: '/confirm', name: 'order-confirm', component: () => import('@/views/OrderConfirmView.vue'), meta: { auth: true } },
  { path: '/seat-select', name: 'seat-select', component: () => import('@/views/SeatSelectView.vue'), meta: { auth: true } },
  { path: '/pay/:id', name: 'pay', component: () => import('@/views/PaymentView.vue'), meta: { auth: true } },
  { path: '/orders', name: 'orders', component: () => import('@/views/OrderListView.vue'), meta: { auth: true } },
  { path: '/order/:id', name: 'order-detail', component: () => import('@/views/OrderDetailView.vue'), meta: { auth: true } },

  { path: '/market', name: 'market', component: () => import('@/views/MarketView.vue') },
  { path: '/ticket/:id', name: 'ticket-detail', component: () => import('@/views/TicketDetailView.vue') },
  { path: '/sell', name: 'sell', component: () => import('@/views/SellTicketView.vue'), meta: { auth: true } },
  { path: '/mine/tickets', name: 'my-tickets', component: () => import('@/views/MyTicketsView.vue'), meta: { auth: true } },

  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },
  { path: '/register', name: 'register', component: () => import('@/views/RegisterView.vue') },

  { path: '/user', name: 'user', component: () => import('@/views/UserView.vue'), meta: { auth: true } },
  { path: '/profile', name: 'profile', component: () => import('@/views/ProfileView.vue'), meta: { auth: true } },
  { path: '/favorites', name: 'favorites', component: () => import('@/views/FavoritesView.vue'), meta: { auth: true } },
  { path: '/history', name: 'history', component: () => import('@/views/HistoryView.vue'), meta: { auth: true } },
  { path: '/messages', name: 'messages', component: () => import('@/views/MessageView.vue'), meta: { auth: true } },

  { path: '/chat', name: 'chat-list', component: () => import('@/views/ChatListView.vue'), meta: { auth: true } },
  { path: '/chat/:id', name: 'chat', component: () => import('@/views/ChatView.vue'), meta: { auth: true } },

  /* ---------------- 后台管理 ---------------- */
  { path: '/admin/login', name: 'admin-login', component: () => import('@/admin/AdminLogin.vue') },
  {
    path: '/admin',
    component: () => import('@/admin/AdminLayout.vue'),
    meta: { auth: true, admin: true },
    redirect: '/admin/dashboard',
    children: [
      { path: 'dashboard', name: 'admin-dashboard', component: () => import('@/admin/AdminDashboard.vue') },
      { path: 'shows', name: 'admin-shows', component: () => import('@/admin/AdminShows.vue') },
      { path: 'invite', name: 'admin-invite', component: () => import('@/admin/AdminInvite.vue') },
      { path: 'users', name: 'admin-users', component: () => import('@/admin/AdminUsers.vue') },
      { path: 'messages', name: 'admin-messages', component: () => import('@/admin/AdminMessages.vue') },
      { path: 'orders', name: 'admin-orders', component: () => import('@/admin/AdminOrders.vue') },
      { path: 'tickets', name: 'admin-tickets', component: () => import('@/admin/AdminTickets.vue') },
      { path: 'banners', name: 'admin-banners', component: () => import('@/admin/AdminBanners.vue') },
    ],
  },

  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

/** 路由守卫：需要登录 / 需要管理员 */
router.beforeEach(async (to) => {
  const store = useUserStore();
  if (!store.loaded) await store.fetchUser();

  if (to.meta.auth && !store.isLogin) {
    return { path: to.path.startsWith('/admin') ? '/admin/login' : '/login', query: { redirect: to.fullPath } };
  }
  if (to.meta.admin && store.userInfo && store.userInfo.role !== 1) {
    window.$toast && window.$toast('无权限访问后台');
    return { path: '/' };
  }
  return true;
});

export default router;
