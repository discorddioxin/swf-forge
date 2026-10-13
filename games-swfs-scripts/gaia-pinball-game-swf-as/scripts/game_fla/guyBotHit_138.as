package game_fla
{
   import flash.display.MovieClip;
   import flash.events.Event;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1222")]
   public dynamic class guyBotHit_138 extends MovieClip
   {
      
      public function guyBotHit_138()
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

