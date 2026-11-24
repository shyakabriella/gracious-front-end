import Link from "next/link";
import {
  AgentIcon,
  BuildingIcon,
  HouseForSaleIcon,
  NewHouseIcon,
} from "@/components/website/ServiceIcons";

const services = [
  {
    title: "Our Properties",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Voluptates, accusamus.",
    href: "/properties",
    Icon: NewHouseIcon,
  },
  {
    title: "Property for Sale",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Voluptates, accusamus.",
    href: "/properties",
    Icon: BuildingIcon,
  },
  {
    title: "Real Estate Agent",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Voluptates, accusamus.",
    href: "/contact",
    Icon: AgentIcon,
  },
  {
    title: "House for Sale",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Voluptates, accusamus.",
    href: "/properties",
    Icon: HouseForSaleIcon,
  },
];

export default function Services() {
  return (
    <section id="services" className="scroll-mt-24 bg-[#FAF7EF] py-16 md:py-20">
      <div className="mx-auto px-6 md:px-[5.5%]">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {services.map(({ title, description, href, Icon }) => (
            <article
              key={title}
              className="flex flex-col items-center rounded-md bg-white px-8 pb-12 pt-10 text-center"
            >
              <div className="text-[#003020]">
                <Icon />
              </div>

              <h3 className="mt-4 text-xl font-medium text-[#003020]">
                {title}
              </h3>

              <p className="mt-5 text-[17px] leading-relaxed text-gray-500">
                {description}
              </p>

              <Link
                href={href}
                className="mt-6 border-b-[3px] border-[#E0A020] pb-2 text-[17px] text-[#003020] transition-colors hover:text-[#8A611A]"
              >
                Learn More
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
