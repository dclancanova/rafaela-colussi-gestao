import { createBrowserRouter, Navigate } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { LoginPage } from './features/auth/LoginPage';
import { RequireAuth } from './features/auth/RequireAuth';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { AdjustmentFormPage } from './features/finance/AdjustmentFormPage';
import { CategoriesPage } from './features/finance/CategoriesPage';
import { FinancePage } from './features/finance/FinancePage';
import { TransactionFormPage } from './features/finance/TransactionFormPage';
import { TransferFormPage } from './features/finance/TransferFormPage';
import { HomePage } from './features/home/HomePage';
import { ProductFormPage } from './features/products/ProductFormPage';
import { ProductsPage } from './features/products/ProductsPage';
import { RecipeFormPage } from './features/recipes/RecipeFormPage';
import { RecipesPage } from './features/recipes/RecipesPage';
import { PricingSettingsPage } from './features/settings/PricingSettingsPage';
import { SuppliesPage } from './features/supplies/SuppliesPage';
import { SupplyFormPage } from './features/supplies/SupplyFormPage';

export const router = createBrowserRouter([
  // Páginas públicas (sem sessão).
  { path: '/login', element: <LoginPage /> },
  { path: '/esqueci-senha', element: <ForgotPasswordPage /> },
  { path: '/redefinir-senha', element: <ResetPasswordPage /> },
  {
    // Tudo aqui dentro exige sessão.
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'insumos', element: <SuppliesPage /> },
          { path: 'insumos/novo', element: <SupplyFormPage /> },
          { path: 'insumos/:id', element: <SupplyFormPage /> },
          { path: 'fichas-tecnicas', element: <RecipesPage /> },
          { path: 'fichas-tecnicas/nova', element: <RecipeFormPage /> },
          { path: 'fichas-tecnicas/:id', element: <RecipeFormPage /> },
          { path: 'produtos', element: <ProductsPage /> },
          { path: 'produtos/novo', element: <ProductFormPage /> },
          { path: 'produtos/:id', element: <ProductFormPage /> },
          { path: 'financeiro', element: <FinancePage /> },
          { path: 'financeiro/entrada/nova', element: <TransactionFormPage kind="income" /> },
          { path: 'financeiro/saida/nova', element: <TransactionFormPage kind="expense" /> },
          { path: 'financeiro/lancamentos/:id', element: <TransactionFormPage /> },
          { path: 'financeiro/transferencia/nova', element: <TransferFormPage /> },
          { path: 'financeiro/ajuste/novo', element: <AdjustmentFormPage /> },
          { path: 'financeiro/categorias', element: <CategoriesPage /> },
          { path: 'configuracoes', element: <PricingSettingsPage /> },
        ],
      },
    ],
  },
  // Endereço desconhecido: volta para o início (que manda para o login se preciso).
  { path: '*', element: <Navigate to="/" replace /> },
]);
