import 'next-auth';
import type { UserRole } from '@/lib/types/auth';

declare module 'next-auth' {
    interface User {
        id: string;
        role: UserRole;
        companyId: string;
    }

    interface Session {
        user: {
            id: string;
            email: string;
            name: string | null;
            role: string;
            companyId: string;
        };
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        id: string;
        role: string;
        companyId: string;
    }
}
