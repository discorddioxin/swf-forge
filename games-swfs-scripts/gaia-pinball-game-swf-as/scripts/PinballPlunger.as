package
{
   import com.gaiaonline.games.gPinball.compound_elements.LaunchPlunger;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1042")]
   public dynamic class PinballPlunger extends LaunchPlunger
   {
      
      public function PinballPlunger()
      {
         super();
         addFrameScript(0,frame1);
      }
      
      internal function frame1() : *
      {
      }
   }
}

