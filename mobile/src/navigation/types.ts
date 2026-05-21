import type { NavigatorScreenParams } from '@react-navigation/native';

export type CatalogStackParamList = {
  CatalogList: undefined;
  ProductDetail: { productId: number };
  ProductReviews: { productId: number; productName: string };
};

export type ReviewEditorParams =
  | {
      mode: 'create';
      productId: number;
      preorderId: number;
      productName: string;
    }
  | {
      mode: 'edit';
      reviewId: number;
      productId: number;
      productName: string;
      rating: number;
      comment: string;
    };

export type ProfileStackParamList = {
  ProfileMenu: undefined;
  PrivacyPolicy: undefined;
  EditProfile: undefined;
  AppearanceSettings: undefined;
  ChangePassword: undefined;
  TwoFactor: undefined;
  OrderSuccess: { orderId: number };
  MyReviewsMain: undefined;
  ReviewEditor: ReviewEditorParams;
};

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  PrivacyPolicy: undefined;
};

export type MainTabParamList = {
  Catalog: NavigatorScreenParams<CatalogStackParamList>;
  Cart: undefined;
  Wishlist: undefined;
  Orders: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};
