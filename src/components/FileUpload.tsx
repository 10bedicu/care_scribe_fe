import { Cross2Icon, UploadIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function FileUpload(props : {
    files: File[];
    setFiles: (files: File[]) => void;
    error: string | null;
}){

    const supported = ["image/jpeg", "image/png", "image/jpg"];
    const { t } = useTranslation();

    const { setFiles, error, files } = props;
    const [isDragging, setIsDragging] = useState(false);

    const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFiles = Array.from(e.dataTransfer.files).filter((file) =>
                supported.includes(file.type)
            );
            if (droppedFiles.length > 0) {
                setFiles([...files, ...droppedFiles]);
            }
            e.dataTransfer.clearData();
        }
    };

    return (
        <div className="flex flex-col items-center justify-center p-4 gap-4">
            <div className="font-bold">
                {t("upload_images")}
            </div>
            {!!files.length && (
                <div className="flex gap-2 items-center flex-wrap max-w-[300px]">
                {files.map((file, index) => (
                    <div className="relative shadow-md rounded-md" key={index}>
                        <button
                            onClick={() => {
                                setFiles(files.filter((_, i) => i !== index));
                            }} 
                        className="absolute -top-2 -right-2 w-5 h-5 bg-white rounded-full shadow-md flex items-center justify-center"
                        >
                            <Cross2Icon className=" h-4 w-4"/>
                        </button>
                    <img  src={URL.createObjectURL(file)} alt="uploaded" className="h-10 w-10 object-cover rounded-md"/>
                    </div>
                ))}
            </div>
            )}
            <label 
                className={`cursor-pointer border border-dashed ${
                    isDragging ? "border-blue-500 bg-blue-100" : "border-gray-300"
                  } hover:bg-gray-100 transition-all rounded-md p-4 w-full flex flex-col gap-4 items-center justify-center`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <UploadIcon className="h-10 w-10"/>
                <div className="text-xs text-gray-500 text-center">
                    {t("upload_images_description")}
                </div>
                <input
                    accept={supported.join(",")}
                    className="hidden"
                    type="file" 
                    multiple
                    onChange={(e) => {
                        if(e.target.files && e.target.files.length > 0){
                            setFiles([...files, ...e.target.files]);
                        }
                    }} 
                />
            </label>
            {error && <p>{error}</p>}    
        </div>
    )
}