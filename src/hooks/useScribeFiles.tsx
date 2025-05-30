import { ScribeFileModel, ScribeModel } from "@/types";
import { API } from "@/utils/api";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export const useScribeFiles = (scribe: ScribeModel | null) => {
  const [audioFiles, setAudioFiles] = useState<ScribeFileModel[] | null>(null);
  const [files, setFiles] = useState<ScribeFileModel[] | null>(null);
  const filesMutation = useMutation<
    ScribeFileModel,
    Error,
    { fileId: string; fileType: string; associatingId: string }
  >({
    mutationFn: ({ fileId, fileType, associatingId }) =>
      API.files.get(fileId, fileType, associatingId),
    onSuccess: (data, params) => {
      if (params.fileType === "SCRIBE_AUDIO") {
        setAudioFiles((prev) => [...(prev || []), data]);
      } else {
        setFiles((prev) => [...(prev || []), data]);
      }
    },
  });

  useEffect(() => {
    if (!scribe) {
      setAudioFiles(null);
      setAudioFiles(null);
      return;
    }
    if (scribe?.audio_file_ids.length) {
      for (const audioId of scribe.audio_file_ids) {
        filesMutation.mutate({
          fileId: audioId,
          fileType: "SCRIBE_AUDIO",
          associatingId: scribe.external_id,
        });
      }
    }
    if (scribe?.document_file_ids.length) {
      for (const docId of scribe.document_file_ids) {
        filesMutation.mutate({
          fileId: docId,
          fileType: "SCRIBE_DOCUMENT",
          associatingId: scribe.external_id,
        });
      }
    }
  }, [scribe]);

  return {
    audioFiles,
    files,
    mutation: filesMutation,
  };
};
