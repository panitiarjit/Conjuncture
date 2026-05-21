import WaitlistHeader from '@/components/WaitlistHeader';
import WaitlistPageContent from '@/components/WaitlistPageContent';

export default function WaitlistPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <WaitlistHeader />
      <WaitlistPageContent />
      <footer className="border-t border-[#E0E0E0] bg-white">
        <div className="container-app py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#717171]">
              &copy; {new Date().getFullYear()} Conjuncture Co., Ltd. &nbsp;|&nbsp; Bangkok, Thailand
            </p>
            <p className="text-xs text-[#717171]">
              Regulated under Thai procurement law
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
