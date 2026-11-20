import { notFound } from "next/navigation";
import { requireStaff, can } from "@/server/auth/session";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
import { formOptions, productFormValues } from "@/app/admin/products/form-data";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaff("products.read", `/admin/products/${id}`);
  const [values, options] = await Promise.all([productFormValues(id), formOptions()]);
  if (!values) notFound();
  const readOnly = !can(user, "products.write");
  return (
    <>
      <PageHeader title={values.name} description={readOnly ? "Read-only: your role can view but not edit products." : undefined} back={{ href: "/admin/products", label: "Products" }} />
      <fieldset disabled={readOnly} className="contents">
        <ProductForm productId={id} initial={values} {...options} canDelete={can(user, "products.delete")} storeUrl={`/p/${values.slug}`} />
      </fieldset>
    </>
  );
}
