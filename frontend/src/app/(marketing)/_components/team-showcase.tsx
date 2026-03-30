"use client";

import { useState } from "react";
import { FaLinkedinIn } from "react-icons/fa";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  description?: string;
  image: string;
  isLocal?: boolean; // true = use Next.js Image from /public
  social?: {
    linkedin?: string;
  };
}

const MEMBERS: TeamMember[] = [
  {
    id: "1",
    name: "Chiara",
    role: "PRODUCT MANAGER",
    description:
      "Product Manager dans une scale-up HealthTech européenne de premier plan. Des années à concevoir des outils numériques pour les professionnels de santé.",
    image: "/chiara.png",
    isLocal: true,
    social: { linkedin: "https://www.linkedin.com/in/chiara-sheldon/" },
  },
  {
    id: "2",
    name: "Valentin",
    role: "INGÉNIEUR IA",
    description:
      "Ingénieur IA spécialisé dans le secteur médical. Il conçoit des systèmes qui transforment des processus cliniques complexes en workflows simples et conformes.",
    image: "/valentin2.png",
    isLocal: true,
    social: { linkedin: "https://www.linkedin.com/in/valentingarnier90/" },
  },
];

interface TeamShowcaseProps {
  members?: TeamMember[];
}

export default function TeamShowcase({ members = MEMBERS }: TeamShowcaseProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="flex flex-col md:flex-row items-center gap-10 md:gap-14 select-none w-full max-w-4xl mx-auto py-8 px-4 md:px-6">
      {/* Photo grid */}
      <div className="flex gap-3 flex-shrink-0">
        {members.map((member, i) => (
          <PhotoCard
            key={member.id}
            member={member}
            className={cn(
              "w-[140px] h-[160px] sm:w-[160px] sm:h-[180px] md:w-[180px] md:h-[200px]",
              i % 2 === 1 && "mt-8 md:mt-12"
            )}
            hoveredId={hoveredId}
            onHover={setHoveredId}
          />
        ))}
      </div>

      {/* Name list */}
      <div className="flex flex-col gap-5 flex-1 w-full">
        {members.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            hoveredId={hoveredId}
            onHover={setHoveredId}
          />
        ))}
      </div>
    </div>
  );
}

function PhotoCard({
  member,
  className,
  hoveredId,
  onHover,
}: {
  member: TeamMember;
  className: string;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}) {
  const isActive = hoveredId === member.id;
  const isDimmed = hoveredId !== null && !isActive;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl cursor-pointer flex-shrink-0 transition-opacity duration-400",
        className,
        isDimmed ? "opacity-60" : "opacity-100"
      )}
      onMouseEnter={() => onHover(member.id)}
      onMouseLeave={() => onHover(null)}
    >
      {member.isLocal ? (
        <Image
          src={member.image}
          alt={member.name}
          width={180}
          height={200}
          className="w-full h-full object-cover transition-[filter] duration-500"
          style={{
            filter: isActive ? "grayscale(0) brightness(1)" : "grayscale(1) brightness(0.77)",
          }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.image}
          alt={member.name}
          className="w-full h-full object-cover transition-[filter] duration-500"
          style={{
            filter: isActive ? "grayscale(0) brightness(1)" : "grayscale(1) brightness(0.77)",
          }}
        />
      )}
    </div>
  );
}

function MemberRow({
  member,
  hoveredId,
  onHover,
}: {
  member: TeamMember;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}) {
  const isActive = hoveredId === member.id;
  const isDimmed = hoveredId !== null && !isActive;

  return (
    <div
      className={cn(
        "cursor-pointer transition-opacity duration-300",
        isDimmed ? "opacity-50" : "opacity-100"
      )}
      onMouseEnter={() => onHover(member.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "w-4 h-3 rounded-[5px] flex-shrink-0 transition-all duration-300",
            isActive ? "bg-zinc-900 w-5" : "bg-zinc-300"
          )}
        />
        <span
          className={cn(
            "text-base md:text-lg font-semibold leading-none tracking-tight transition-colors duration-300",
            isActive ? "text-zinc-900" : "text-zinc-600"
          )}
        >
          {member.name}
        </span>

        {member.social?.linkedin && (
          <div
            className={cn(
              "flex items-center gap-1.5 ml-0.5 transition-all duration-200",
              isActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"
            )}
          >
            <a
              href={member.social.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-all duration-150 hover:scale-110"
              title="LinkedIn"
            >
              <FaLinkedinIn size={10} />
            </a>
          </div>
        )}
      </div>

      <p className="mt-1.5 pl-[27px] text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400">
        {member.role}
      </p>
      {member.description && (
        <p
          className={cn(
            "mt-2 pl-[27px] text-xs text-zinc-400 leading-relaxed max-w-sm transition-all duration-300",
            isActive ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
          )}
        >
          {member.description}
        </p>
      )}
    </div>
  );
}
