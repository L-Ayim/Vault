// src/pages/StoragePage.tsx

import { useEffect, useState, type ChangeEvent } from "react";
import { useQuery, useMutation, ApolloError, NetworkStatus } from "@apollo/client";
import Header from "../components/Header";
import {
  QUERY_MY_FILES,
  MUTATION_UPLOAD_FILE,
  MUTATION_DELETE_FILE,
} from "../graphql/operations";
import { FileText, Trash2, UploadCloud, Download } from "lucide-react";

interface FileNode {
  id: string;
  name: string;
  createdAt: string;  // ISO string
  downloadUrl: string;
}

interface QueryMyFilesResult {
  myFiles: FileNode[];
}

interface UploadFileResult {
  uploadFile: {
    file: FileNode;
    version: {
      id: string;
      uploadUrl: string;
      note: string | null;
      createdAt: string;
    };
  };
}

interface DeleteFileResult {
  deleteFile: { ok: boolean };
}

export default function StoragePage() {
  // 1) Set page title
  useEffect(() => {
    document.title = "Storage";
  }, []);

  // 2) AuthContext

  // 3) Fetch existing files
  const { data, loading, error, refetch, networkStatus } = useQuery<QueryMyFilesResult>(
    QUERY_MY_FILES,
    { fetchPolicy: "network-only", notifyOnNetworkStatusChange: true }
  );
  const isRefetching = networkStatus === NetworkStatus.refetch;
  const allFiles: FileNode[] = data?.myFiles || [];

  // 4) State for selected files (multiple) + upload status
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 5) Single-file upload mutation
  const [uploadFileMutation] = useMutation<UploadFileResult>(MUTATION_UPLOAD_FILE, {
    onError: (err: ApolloError) => {
      setUploadError(err.message);
    },
  });

  // 6) Delete mutation (refetch on success)
  const [deleteFile] = useMutation<DeleteFileResult>(MUTATION_DELETE_FILE, {
    onCompleted: () => {
      refetch();
    },
  });

  // 7) Handle file selection (multiple)
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      setSelectedFiles([]);
      return;
    }
    setSelectedFiles(Array.from(files));
  };

  // 8) Loop over each selected file and upload one by one
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setUploadError(null);

    for (const file of selectedFiles) {
      try {
        await uploadFileMutation({
          variables: {
            name: file.name,
            upload: file,
          },
        });
      } catch {
        // onError above already recorded the message
      }
    }

    // Once all uploads are done:
    setSelectedFiles([]);
    await refetch();
    setUploading(false);
  };

  // 9) Delete a file by ID, then refetch
  const handleDelete = async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) return;
    try {
      await deleteFile({ variables: { fileId } });
    } catch {
      // swallow or show a separate toast
    }
  };

  // 10) Search + pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const FILES_PER_PAGE = 10;

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const filteredFiles = allFiles.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.ceil(filteredFiles.length / FILES_PER_PAGE);
  const paginatedFiles = filteredFiles.slice(
    (currentPage - 1) * FILES_PER_PAGE,
    currentPage * FILES_PER_PAGE
  );

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  // 11) Render
  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white">
      {/* Header */}
      <Header />

      {/* Main content */}
      <main className="flex-grow p-6 overflow-auto">
        {/* Upload Form */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            Upload New File{selectedFiles.length > 1 ? "s" : ""}
          </h2>
          <form
            onSubmit={handleUploadSubmit}
            className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-4"
          >
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="w-full file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-neutral-700 file:text-white hover:file:bg-neutral-600"
            />
            <button
              type="submit"
              disabled={uploading || selectedFiles.length === 0}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-3 bg-orange-500 text-white rounded-md font-medium shadow hover:bg-red-600 active:bg-red-700 transition-colors duration-200 disabled:opacity-50"
            >
              <UploadCloud size={20} className="text-white" />
              <span>
                {uploading
                  ? "Uploading…"
                  : `Upload${selectedFiles.length > 1 ? ` (${selectedFiles.length})` : ""}`}
              </span>
            </button>
          </form>
          {uploadError && <p className="text-red-400 mt-2">{uploadError}</p>}
        </section>

        {/* Search + List */}
        <section>
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center mb-4 space-y-2 sm:space-y-0 sm:space-x-4">
            <h2 className="text-2xl font-semibold">My Files</h2>
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by name…"
              className="w-full sm:w-64 px-3 py-2 bg-neutral-700 text-white border border-neutral-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {loading || isRefetching ? (
            <p className="text-gray-400">Loading files…</p>
          ) : error ? (
            <p className="text-red-400">Error fetching files: {error.message}</p>
          ) : filteredFiles.length === 0 ? (
            <p className="text-gray-400">
              {searchTerm ? "No files match that search." : "You have no files uploaded."}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex flex-col sm:flex-row justify-between bg-neutral-800/75 p-4 rounded-md shadow"
                >
                  <div className="flex items-center space-x-3">
                    <FileText size={24} className="text-orange-500" />
                    <div>
                      <a
                        href={file.downloadUrl}
                        download={file.name}
                        className="text-lg font-medium hover:underline"
                      >
                        {file.name}
                      </a>
                      <p className="text-sm text-gray-300">
                        {new Date(file.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <a
                      href={file.downloadUrl}
                      download={file.name}
                      className="flex items-center px-3 py-1 bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800 transition-colors duration-200"
                    >
                      <Download size={16} className="text-white" />
                      <span className="text-sm text-white">Download</span>
                    </a>
                    <button
                      onClick={() => handleDelete(file.id)}
                      className="flex items-center space-x-1 px-3 py-1 bg-red-600 rounded-md hover:bg-red-700 active:bg-red-800 transition-colors duration-200"
                    >
                      <Trash2 size={16} className="text-white" />
                      <span className="text-sm text-white">Delete</span>
                    </button>
                  </div>
                </div>
              ))}

              {/* Pagination Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-2 mt-6">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="w-full sm:w-auto px-3 py-2 bg-neutral-700 rounded-md text-gray-200 hover:bg-neutral-600 disabled:opacity-50 transition-colors duration-200"
                >
                  Previous
                </button>
                <span className="text-gray-300">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="w-full sm:w-auto px-3 py-2 bg-neutral-700 rounded-md text-gray-200 hover:bg-neutral-600 disabled:opacity-50 transition-colors duration-200"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
