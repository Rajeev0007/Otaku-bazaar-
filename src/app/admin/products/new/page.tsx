import { requireStaff, can } from "@/server/auth/session";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
import { blankProduct, formOptions } from "@/app/admin/products/form-data";

export default async function NewProductPage() {
  const user = await requireStaff("products.write", "/admin/products/new");
  const options = await formOptions();
  return (
    <>
      <PageHeader title="Add product" back={{ href: "/admin/products", label: "Products" }} />
      <ProductForm productId={null} initial={blankProduct()} {...options} canDelete={can(user, "products.delete")} />
    </>
  );
}
