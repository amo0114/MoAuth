"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TocEntry {
  id: string;
  title: string;
  level: number;
}

export function DocsToc() {
  const [headings, setHeadings] = useState<TocEntry[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    // A simplified approach to gather headings in the document body
    const elements = Array.from(document.querySelectorAll("main h2, main h3"));
    const newHeadings = elements.map((el) => ({
      id: el.id || el.textContent?.replace(/\s+/g, "-").toLowerCase() || "",
      title: el.textContent || "",
      level: Number(el.tagName.substring(1)),
    }));

    // Assign ids to elements if they don't have one
    elements.forEach((el, index) => {
      if (!el.id) el.id = newHeadings[index].id;
    });

    setHeadings(newHeadings);

    // Simple Intersection Observer for scroll spy
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "0% 0% -80% 0%" }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  if (headings.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="font-medium text-sm">目录</p>
      <ul className="m-0 list-none text-sm">
        {headings.map((heading, index) => (
          <li
            key={index}
            className={cn("mt-0 pt-2", heading.level === 3 && "pl-4")}
          >
            <a
              href={`#${heading.id}`}
              className={cn(
                "inline-block no-underline transition-colors hover:text-foreground",
                heading.id === activeId
                  ? "font-medium text-primary"
                  : "text-muted-foreground"
              )}
            >
              {heading.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
