package game_fla
{
   import flash.display.MovieClip;
   import flash.events.Event;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1232")]
   public dynamic class galBotHit_144 extends MovieClip
   {
      
      public function galBotHit_144()
      {
         super();
         addFrameScript(20,frame21);
      }
      
      internal function frame21() : *
      {
         dispatchEvent(new Event("animDone"));
         stop();
      }
   }
}

