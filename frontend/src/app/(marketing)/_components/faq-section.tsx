"use client";

import * as React from "react";
import { HelpCircle, MessageCircle, ChevronDown } from "lucide-react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "Mes données patients sont-elles stockées ?",
    answer:
      "Non. Zéro. Nada. Aucun document patient n'est conservé sur nos serveurs. Vos fichiers sont traités en mémoire, le rapport est généré, et tout est purgé. Ce qui n'est jamais stocké ne peut jamais fuiter.",
  },
  {
    question: "Ça marche uniquement pour les rapports AI ?",
    answer:
      "Non ! Adminds génère tout type de rapport médical : rapports d'assurance invalidité, rapports médicaux, attestations de perte de gain, rapports d'assurance privée... Si c'est un formulaire que vous remplissez entre deux patients, on s'en occupe.",
  },
  {
    question: "Comment l'IA sait-elle quoi écrire ?",
    answer:
      "Vous importez le dossier patient (PDF, Word, images, même vos notes manuscrites). L'IA extrait, structure et croise les informations pour remplir chaque champ du formulaire cantonal. Vous relisez, vous corrigez si nécessaire, vous validez. Le médecin reste maître.",
  },
  {
    question: "C'est conforme juridiquement ?",
    answer:
      "Chaque rapport intègre automatiquement les critères de Foerster (ATF 141 V 281), les codes CIM-10 vérifiés, les exigences cantonales et la jurisprudence du Tribunal fédéral. On ne vous laisse pas signer un rapport bancal.",
  },
  {
    question: "Je peux utiliser mes propres modèles de rapport ?",
    answer:
      "Absolument. Importez vos templates DOCX ou PDF. L'IA détecte automatiquement les champs à remplir, les labellise, et les intègre dans le flux de génération. Vos formulaires, notre moteur.",
  },
  {
    question: "Et les notes manuscrites entre deux patients ?",
    answer:
      "On les lit aussi. Notre système utilise la reconnaissance visuelle pour déchiffrer vos notes griffonnées sur papier, ordonnances scannées ou photos de documents. Oui, même votre écriture de médecin.",
  },
];

function CustomAccordionItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item className={cn("", className)} {...props} />;
}

function CustomAccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          "group flex flex-1 items-center justify-between gap-4 rounded-2xl p-4 text-left",
          "bg-white transition-all hover:bg-zinc-50 hover:shadow-md",
          "data-[state=open]:shadow-md",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-4">
          <HelpCircle className="h-5 w-5 text-indigo-500" />
          <span className="text-base sm:text-lg font-medium text-zinc-700 tracking-wide" style={{ fontFamily: "var(--font-serif)" }}>
            {children}
          </span>
        </div>
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 transition-transform group-hover:scale-105 group-data-[state=open]:rotate-180">
          <ChevronDown className="h-4 w-4 text-zinc-600" />
        </div>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function CustomAccordionContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      className={cn(
        "overflow-hidden",
        "data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down pb-2",
        className
      )}
      {...props}
    >
      <div className="mt-4 ml-14">
        <div className="flex items-start gap-4 rounded-2xl bg-white p-4 shadow-md transition-all">
          <span className="flex-1 text-sm sm:text-base leading-relaxed text-zinc-600" style={{ fontFamily: "var(--font-serif)" }}>
            {children}
          </span>
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 transition-transform hover:scale-105">
            <MessageCircle className="h-4 w-4 text-indigo-500" />
          </div>
        </div>
      </div>
    </AccordionPrimitive.Content>
  );
}

export default function FaqSection() {
  return (
    <div className="max-w-3xl w-full mx-auto">
      <AccordionPrimitive.Root
        type="single"
        collapsible
        defaultValue="item-0"
        className="space-y-4"
      >
        {faqs.map((faq, index) => (
          <CustomAccordionItem key={index} value={`item-${index}`}>
            <CustomAccordionTrigger>{faq.question}</CustomAccordionTrigger>
            <CustomAccordionContent>{faq.answer}</CustomAccordionContent>
          </CustomAccordionItem>
        ))}
      </AccordionPrimitive.Root>
    </div>
  );
}
