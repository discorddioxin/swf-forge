package game_fla
{
   import flash.display.MovieClip;
   import flash.events.Event;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1212")]
   public dynamic class tipped_131 extends MovieClip
   {
      
      public function tipped_131()
      {
         super();
         addFrameScript(45,frame46);
      }
      
      internal function frame46() : *
      {
         dispatchEvent(new Event("animDone"));
         stop();
      }
   }
}

