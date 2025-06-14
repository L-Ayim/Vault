import { useState } from "react";
import { useLazyQuery } from "@apollo/client";
import { QUERY_FILE_VERSIONS } from "../graphql/operations";
import { ChevronDown, ChevronRight, Download } from "lucide-react";

interface Props {
  fileId: string;
}

interface Version {
  id: string;
  uploadUrl: string;
  note: string | null;
  fileName: string;
  createdAt: string;
}

interface QueryResult {
  fileVersions: Version[];
}

export default function FileVersionsDropdown({ fileId }: Props) {
  const [open, setOpen] = useState(false);
  const [fetchVersions, { data, loading, called }] = useLazyQuery<QueryResult>(
    QUERY_FILE_VERSIONS,
    { variables: { fileId } }
  );

  const toggle = () => {
    if (!open && !called) {
      fetchVersions();
    }
    setOpen((o) => !o);
  };

  const versions = data?.fileVersions || [];

  return (
    <div className="mt-1">
      <button
        onClick={toggle}
        className="flex items-center text-sm text-orange-300 hover:text-orange-400 focus:outline-none"
      >
        {open ? (
          <ChevronDown size={14} className="text-orange-300" />
        ) : (
          <ChevronRight size={14} className="text-orange-300" />
        )}
        <span className="ml-1">Versions</span>
      </button>
      {open && (
        <ul className="mt-1 space-y-2 pl-5 sm:pl-6">
          {loading ? (
            <li className="text-gray-400 text-sm">Loading…</li>
          ) : versions.length === 0 ? (
            <li className="text-gray-400 text-sm">No versions</li>
          ) : (
            versions.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between bg-neutral-800/60 px-3 py-2 rounded"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {v.note?.trim() || v.fileName || "Untitled version"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(v.createdAt).toLocaleString()}
                  </p>
                </div>
                <a
                  href={v.uploadUrl}
                  download
                  className="ml-2 shrink-0 p-1 bg-neutral-700 hover:bg-red-600 rounded"
                >
                  <Download size={12} className="text-white" />
                </a>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
