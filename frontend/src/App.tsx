// En App.tsx
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './common/contex';
import AppRoutes from './routes/AppRoutes';

const App = () => {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;