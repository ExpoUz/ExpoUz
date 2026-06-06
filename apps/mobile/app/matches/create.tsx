import { Redirect } from 'expo-router';

// Redirect /matches/create to the modal create-match screen
export default function MatchesCreateRedirect() {
  return <Redirect href="/create-match" />;
}
