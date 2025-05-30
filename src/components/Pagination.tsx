"use client";

import { useState, useEffect } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface PaginationResponse<T> {
  next: string | null;
  previous: string | null;
  count: number;
  results: T[];
}

interface PaginationControlsProps<T> {
  data: PaginationResponse<T>;
  onPageChange: (url: string) => void;
  itemsPerPage?: number;
}

export function PaginationControls<T>({
  data,
  onPageChange,
  itemsPerPage = 10,
}: PaginationControlsProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    // Calculate total pages based on count and items per page
    const pages = Math.ceil(data.count / itemsPerPage);
    setTotalPages(pages);
    // calculate current page from URL
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get("page");
    const page = pageParam ? parseInt(pageParam) : 1;
    setCurrentPage(page);
  }, [data, itemsPerPage]);

  const handlePageChange = (pageNumber?: number) => {
    if (pageNumber) {
      onPageChange(getPageUrl(pageNumber));
      setCurrentPage(pageNumber);
    }
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];

    // Always show first page
    pages.push(1);

    // Calculate range around current page
    const startPage = Math.max(2, currentPage - 1);
    const endPage = Math.min(totalPages - 1, currentPage + 1);

    // Add ellipsis after first page if needed
    if (startPage > 2) {
      pages.push("ellipsis-start");
    }

    // Add pages around current page
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    // Add ellipsis before last page if needed
    if (endPage < totalPages - 1) {
      pages.push("ellipsis-end");
    }

    // Always show last page if there's more than one page
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  // Extract page number from URL
  const getPageUrl = (pageNumber: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set("page", pageNumber.toString());
    return url.toString();
  };

  return (
    <Pagination>
      <PaginationContent>
        {/* First page */}
        {currentPage > 1 && (
          <PaginationItem>
            <PaginationLink onClick={() => handlePageChange(1)} href="#">
              First
            </PaginationLink>
          </PaginationItem>
        )}

        {/* Previous page */}
        <PaginationItem>
          <PaginationPrevious
            onClick={() => handlePageChange(currentPage - 1)}
            href="#"
            aria-disabled={!data.previous}
            className={!data.previous ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>

        {/* Page numbers */}
        {getPageNumbers().map((page, index) =>
          typeof page === "number" ? (
            <PaginationItem key={index}>
              <PaginationLink
                href="#"
                onClick={() => handlePageChange(page)}
                isActive={currentPage === page}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          ) : (
            <PaginationItem key={index}>
              <PaginationEllipsis />
            </PaginationItem>
          ),
        )}

        {/* Next page */}
        <PaginationItem>
          <PaginationNext
            onClick={() => handlePageChange(currentPage + 1)}
            href="#"
            aria-disabled={!data.next}
            className={!data.next ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>

        {/* Last page */}
        {currentPage < totalPages && (
          <PaginationItem>
            <PaginationLink
              onClick={() => handlePageChange(totalPages)}
              href="#"
            >
              Last
            </PaginationLink>
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}
