import React from 'react';
import {createRoot,hydrateRoot} from 'react-dom/client';
import App from './App.tsx';
import './globals.css';
const root=document.getElementById('root')!;
if(root.hasChildNodes())hydrateRoot(root,<App/>);
else createRoot(root).render(<App/>);
