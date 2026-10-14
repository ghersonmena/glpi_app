import React from 'react';
import type { GLPISession } from '../types/glpi';
import { GLPIService, PHOTO_CATEGORIES } from '../services/glpiService';
import { ItemPhotos } from './ItemPhotos';

interface TaskPhotosProps {
  session: GLPISession;
  taskId: number;
  taskName: string;
  indent: number;
  onCountChange?: (count: number) => void;
}

// Fotos de evidencia de un equipo en mantenimiento: se clasifican como Previo/Post
// mantenimiento y se ligan a la tarea del equipo
export const TaskPhotos: React.FC<TaskPhotosProps> = ({ session, taskId, taskName, indent, onCountChange }) => (
  <ItemPhotos
    session={session}
    sourceKey={`ProjectTask#${taskId}`}
    categories={PHOTO_CATEGORIES}
    loadPhotos={() => GLPIService.getTaskPhotos(session, taskId)}
    uploadPhoto={(photo, categoryId, index) => GLPIService.uploadTaskPhoto(session, taskId, taskName, photo, categoryId, index)}
    indent={indent}
    onCountChange={onCountChange}
  />
);
