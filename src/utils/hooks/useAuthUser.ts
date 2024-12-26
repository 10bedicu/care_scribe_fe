import { UserModel } from "@/types";
import { createContext, useContext } from "react";


export interface RequestResult<TData> {
    res: Response | undefined;
    data: TData | undefined;
    error: undefined | Record<string, unknown>;
}


export interface JwtTokenObtainPair {
    access: string;
    refresh: string;
}

export interface LoginCredentials {
    username: string;
    password: string;
}

type SignInReturnType = RequestResult<JwtTokenObtainPair>;

type AuthContextType = {
    user: UserModel | undefined;
    signIn: (creds: LoginCredentials) => Promise<SignInReturnType>;
    signOut: () => Promise<void>;
    refetchUser: () => Promise<RequestResult<UserModel>>;
};

export const AuthUserContext = createContext<AuthContextType | null>(null);

export const useAuthContext = () => {
    const ctx = useContext(AuthUserContext);
    if (!ctx) {
        throw new Error(
            "'useAuthContext' must be used within 'AuthUserProvider' only",
        );
    }
    return ctx;
};

export default function useAuthUser() {
    const user = useAuthContext().user;
    if (!user) {
        throw new Error("'useAuthUser' must be used within 'AppRouter' only");
    }
    return user;
}
