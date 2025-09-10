import IdeasPage from '@/features/ideas/components/IdeasPage';

interface IdeasProps {
  showMobileFeed?: boolean;
}

export default function Ideas({ showMobileFeed = false }: IdeasProps) {
  return <IdeasPage showMobileFeed={showMobileFeed} />;
}