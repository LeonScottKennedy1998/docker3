import { getApiBaseUrl } from './apiBase';

const base = () => getApiBaseUrl();

export const urls = {
  auth: {
    login: `${base()}/auth/login`,
    profile: `${base()}/auth/profile`,
    updateProfile: `${base()}/auth/profile`,
    preferences: `${base()}/auth/preferences`,
    changePassword: `${base()}/auth/change-password`,
    logout: `${base()}/auth/logout`,
    forgotPassword: `${base()}/auth/forgot-password`,
    twoFactorStatus: `${base()}/auth/two-factor/status`,
    twoFactorEnable: `${base()}/auth/two-factor/enable`,
    twoFactorDisable: `${base()}/auth/two-factor/disable`,
    twoFactorVerify: `${base()}/auth/two-factor/verify`,
    twoFactorResend: `${base()}/auth/two-factor/resend-code`,
  },
  products: {
    list: `${base()}/products`,
    batch: `${base()}/products/batch`,
    categories: `${base()}/products/categories`,
    byId: (id: number | string) => `${base()}/products/${id}`,
  },
  orders: {
    my: `${base()}/orders/my-orders`,
    create: `${base()}/orders`,
    statuses: `${base()}/orders/statuses`,
  },
  wishlist: {
    base: `${base()}/wishlist`,
    remove: (productId: number | string) => `${base()}/wishlist/${productId}`,
    check: (productId: number | string) => `${base()}/wishlist/check/${productId}`,
  },
  reviews: {
    reviewable: `${base()}/reviews/available`,
    my: `${base()}/reviews/my-reviews`,
    product: (productId: number | string) => `${base()}/reviews/product/${productId}`,
    create: (productId: number | string) => `${base()}/reviews/product/${productId}`,
    update: (reviewId: number | string) => `${base()}/reviews/${reviewId}`,
    delete: (reviewId: number | string) => `${base()}/reviews/${reviewId}`,
  },
  cart: {
    base: `${base()}/cart`,
  },
};
