import Image, { type ImageProps } from "next/image";

/** next/image wrapper. Generated SVG demo art and other SVGs skip the optimizer (it does not rasterise SVG). */
export function ProductImage(props: ImageProps & { src: string }) {
  const unoptimized = props.unoptimized ?? (props.src.includes(".svg") || props.src.startsWith("/demo-art/"));
  return <Image {...props} unoptimized={unoptimized} alt={props.alt} />;
}
